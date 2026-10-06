import { NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { aiBudgetPlanSchema, safeParseBody } from "@/lib/validation"
import { generateAiBudgetPlanForUser, BudgetAiError } from "@/lib/budget-ai"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/budgets/ai-plan
 * Body: { month: "YYYY-MM", apply?: boolean }
 *
 * Admin-only. Generates a budget for `month` from the immediately preceding
 * budget month's actual spending using Groq AI. Regular users get the
 * deterministic 50/30/20 planner at /api/budgets/plan instead. By default the
 * plan is returned for preview only; pass `apply: true` to upsert it over the
 * user's budgets for that month.
 */
export async function POST(req: Request) {
  // Admins only — this endpoint calls an external, metered AI service.
  const userId = await requireAdminUser()
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

    const { month, apply } = parsed.data
    const plan = await generateAiBudgetPlanForUser(userId, month)

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
