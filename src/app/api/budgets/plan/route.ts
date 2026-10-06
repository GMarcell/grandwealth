import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { budgetPlanSchema, safeParseBody } from "@/lib/validation"
import { generateBudgetPlanForUser, BudgetPlanError } from "@/lib/budget-planner"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/budgets/plan
 * Body: { month: "YYYY-MM", apply?: boolean }
 *
 * Proposes a budget for `month` using the 50/30/20 rule, built from last
 * month's actual spending and the user's category classifications. No external
 * AI call — the plan is computed from existing data. By default it is returned
 * for preview only; pass `apply: true` to upsert it over the month's budgets.
 */
export async function POST(req: Request) {
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

  const limiter = await rateLimit(`budget-plan:${userId}`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    )
  }

  try {
    const parsed = await safeParseBody(req, budgetPlanSchema)
    if ("error" in parsed) return parsed.error

    const { month, apply } = parsed.data
    const plan = await generateBudgetPlanForUser(userId, month)

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
      message: `Applied 50/30/20 plan — ${created} created, ${updated} updated`,
      plan,
    })
  } catch (error) {
    if (error instanceof BudgetPlanError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Budget plan error:", error)
    return NextResponse.json(
      { error: "Failed to generate budget plan" },
      { status: 500 },
    )
  }
}
