import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import {
  getBudgetMonthRange,
  getBudgetMonthLabel,
  getCurrentBudgetMonthKey,
  getPreviousBudgetMonthKey,
} from "@/lib/budget-months"
import {
  buildSpentByMonthCategory,
  computeCarryOverChain,
} from "@/lib/budget-carry-over"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const userId = session.user.id

  try {
    // Get user's budget start day setting
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { budgetStartDay: true, carryOverEnabled: true },
    })
    const startDay = user?.budgetStartDay ?? 1
    // Global switch — carry-over is applied for every category when on.
    const carryOverEnabled = user?.carryOverEnabled ?? true

    // Last 13 budget months, oldest → newest, ending with the CURRENT budget
    // month (never a not-yet-started one). Consecutive keys are unique, so no
    // dedupe is required.
    const uniqueMonths: string[] = []
    let cursor = getCurrentBudgetMonthKey(startDay)
    for (let i = 0; i < 13; i++) {
      uniqueMonths.unshift(cursor)
      cursor = getPreviousBudgetMonthKey(cursor, startDay)
    }

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        month: { in: uniqueMonths },
      },
      orderBy: [{ categoryName: "asc" }, { month: "asc" }],
    })

    // Get all transactions across the full range. `uniqueMonths` is oldest →
    // newest, so the window runs from the START of the oldest month to the END
    // of the newest. (These indexes were previously reversed, which produced a
    // start > end window and counted zero spend.)
    const firstMonthKey = uniqueMonths[0]
    const lastMonthKey = uniqueMonths[uniqueMonths.length - 1]
    const { start: startDate } = getBudgetMonthRange(firstMonthKey, startDay)
    const { end: endDate } = getBudgetMonthRange(lastMonthKey, startDay)

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    })

    // Expense totals bucketed by budget month + category (shared helper).
    const spentByMonthCategory = buildSpentByMonthCategory(transactions, startDay)

    // Compounded carry-over for the whole chain (shared helper) so this table,
    // the budgets page, and the dashboard all agree.
    const carryOverChain = computeCarryOverChain({
      months: uniqueMonths,
      budgets,
      spentByMonthCategory,
      carryOverEnabled,
    })

    // Get unique category names that have budgets
    const categoryNames = [...new Set(budgets.map((b) => b.categoryName))].sort()

    // Build the month-over-month rows for each category
    const categories = categoryNames.map((categoryName) => {
      const monthEntries = uniqueMonths
        .map((month) => {
          const entry = carryOverChain.get(month)?.get(categoryName)
          if (!entry) return null

          const rolloverCap =
            budgets.find(
              (b) => b.categoryName === categoryName && b.month === month,
            )?.rolloverCap ?? null

          return {
            month,
            monthLabel: getBudgetMonthLabel(month, startDay),
            budgetAmount: entry.amount,
            spent: entry.spent,
            rolloverReceived: entry.rollover,
            unused: entry.unused,
            carryOverEnabled,
            rolloverCap,
            effectiveBudget: entry.effectiveAmount,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

      return {
        categoryName: categoryName.replace("_", " "),
        months: monthEntries,
      }
    })

    // Filter to only categories with data
    const categoriesWithData = categories.filter((c) => c.months.length > 0)

    return NextResponse.json({
      months: uniqueMonths.map((m) => ({ key: m, label: getBudgetMonthLabel(m, startDay) })),
      categories: categoriesWithData,
    })
  } catch (error) {
    console.error("Rollover history error:", error)
    return NextResponse.json(
      { error: "Failed to load rollover history" },
      { status: 500 }
    )
  }
}
