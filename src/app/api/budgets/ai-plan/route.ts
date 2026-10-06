import { NextResponse } from "next/server"
import { requireAdminOrProPlusUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { aiBudgetPlanSchema, safeParseBody } from "@/lib/validation"
import { generateAiBudgetPlanForUser, BudgetAiError } from "@/lib/budget-ai"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/budgets/ai-plan
 * Body: { month: "YYYY-MM", apply?: boolean, maxTotalBudget?: number }
 *
 * Pro+ (and admin). Generates a budget for `month` from the immediately
 * preceding budget month's actual spending using Groq AI. Regular Pro users
 * get the deterministic 50/30/20 planner at /api/budgets/plan instead. By
 * default the plan is returned for preview only; pass `apply: true` to upsert
 * it over the user's budgets for that month.
 *
 * Categories with `canReduce: false` in existing budgets will not have their
 * budget reduced by the AI.
 */
export async function POST(req: Request) {
  // Pro+ exclusive (admins always pass) — this endpoint calls an external,
  // metered AI service.
  const userId = await requireAdminOrProPlusUser()
  if (userId instanceof NextResponse) return userId

  const limiter = await rateLimit(`budget-ai-plan:${userId}`, {
    limit: 5,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    )
  }

  try {
    const parsed = await safeParseBody(req, aiBudgetPlanSchema)
    if ("error" in parsed) return parsed.error

    const { month, apply, maxTotalBudget } = parsed.data

    // Get existing budgets to find which categories cannot be reduced
    const existingBudgets = await prisma.budget.findMany({
      where: { userId, month },
      select: { categoryName: true, canReduce: true },
    })
    const cannotReduceCategories = existingBudgets
      .filter((b) => !b.canReduce)
      .map((b) => b.categoryName)

    const plan = await generateAiBudgetPlanForUser(
      userId,
      month,
      maxTotalBudget,
      cannotReduceCategories,
    )

    if (!apply) {
      return NextResponse.json({ applied: false, plan })
    }

    const existing = await prisma.budget.findMany({
      where: { userId, month },
      select: { categoryName: true },
    })
    const existingNames = new Set(existing.map((b) => b.categoryName))

    let created = 0
    let updated = 0
    for (const budget of plan.budgets) {
      const wasExisting = existingNames.has(budget.categoryName)
      await prisma.budget.upsert({
        where: {
          categoryName_month_userId: {
            categoryName: budget.categoryName,
            month,
            userId,
          },
        },
        create: {
          categoryName: budget.categoryName,
          amount: budget.amount,
          month,
          userId,
        },
        update: { amount: budget.amount },
      })
      if (wasExisting) updated++
      else created++
    }

    return NextResponse.json({
      applied: true,
      created,
      updated,
      message: `Applied AI budget plan — ${created} created, ${updated} updated`,
      plan,
    })
  } catch (error) {
    if (error instanceof BudgetAiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("AI budget plan error:", error)
    return NextResponse.json(
      { error: "Failed to generate AI budget plan" },
      { status: 500 },
    )
  }
}
