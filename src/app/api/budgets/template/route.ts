import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { budgetTemplateSchema, safeParseBody } from "@/lib/validation"
import { buildBudgetTemplate } from "@/lib/budget-template"
import { getBudgetMonthRangeInclusive } from "@/lib/budget-months"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

/**
 * POST /api/budgets/template
 * Body: { month: "YYYY-MM" }
 *
 * Auto-generates budgets for the given month using the 50/30/20 rule,
 * based on the month's income and the user's NEED/WANT/SAVINGS classifications.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const limiter = await rateLimit(`budget-template:${session.user.id}`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, budgetTemplateSchema)
    if ("error" in parsed) return parsed.error

    const { month } = parsed.data

    const [user, categories] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { budgetStartDay: true },
      }),
      prisma.category.findMany({
        where: { userId: session.user.id, ruleType: { not: null } },
        select: { name: true, ruleType: true },
      }),
    ])

    const startDay = user?.budgetStartDay ?? 1
    const { start, end } = getBudgetMonthRangeInclusive(month, startDay)

    // Income for the target month.
    const monthTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: { gte: start, lte: end },
      },
      select: { type: true, category: true, amount: true, date: true },
    })

    const income = monthTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0)

    if (income <= 0) {
      return NextResponse.json(
        {
          error:
            "No income found for this month. Record income first so the template knows how much to allocate.",
          created: 0,
        },
        { status: 400 }
      )
    }

    // Historical spending (average over the previous 3 months) for weighting.
    const prevMonths: Array<{ start: Date; end: Date }> = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date(start)
      d.setMonth(d.getMonth() - i)
      prevMonths.push(getBudgetMonthRangeInclusive(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        startDay
      ))
    }

    const historyTx = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: "EXPENSE",
        OR: prevMonths.map((range) => ({
          date: { gte: range.start, lte: range.end },
        })),
      },
      select: { category: true, amount: true },
    })

    const categoryTotals = new Map<string, number>()
    for (const tx of historyTx) {
      categoryTotals.set(
        tx.category,
        (categoryTotals.get(tx.category) ?? 0) + tx.amount
      )
    }
    const historyByCategory: Record<string, number> = {}
    for (const [name, total] of categoryTotals) {
      historyByCategory[name] = total / prevMonths.length
    }

    const { budgets, skippedGroups } = buildBudgetTemplate({
      income,
      categories: categories.map((c) => ({
        name: c.name,
        ruleType: c.ruleType as "NEED" | "WANT" | "SAVINGS",
      })),
      historyByCategory,
    })

    // Upsert each generated budget for the month.
    const existing = await prisma.budget.findMany({
      where: { userId: session.user.id, month },
    })
    const existingNames = new Set(existing.map((b) => b.categoryName))

    let created = 0
    let updated = 0
    for (const budget of budgets) {
      const wasExisting = existingNames.has(budget.categoryName)
      await prisma.budget.upsert({
        where: {
          categoryName_month_userId: {
            categoryName: budget.categoryName,
            month,
            userId: session.user.id,
          },
        },
        create: {
          categoryName: budget.categoryName,
          amount: budget.amount,
          month,
          userId: session.user.id,
        },
        update: { amount: budget.amount },
      })
      if (wasExisting) updated++
      else created++
    }

    return NextResponse.json({
      message: `Created ${created} and updated ${updated} budget(s) from the 50/30/20 rule`,
      income,
      skippedGroups,
      budgets,
      created,
      updated,
    })
  } catch (error) {
    console.error("Budget template error:", error)
    return NextResponse.json(
      { error: "Failed to generate budget template" },
      { status: 500 }
    )
  }
}
