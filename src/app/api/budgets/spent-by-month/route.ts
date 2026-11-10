import { NextResponse } from "next/server"
import { withUser } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import {
  getBudgetMonthRangeInclusive,
  getCurrentBudgetMonthKey,
} from "@/lib/budget-months"
import { buildSpentByMonthCategory } from "@/lib/budget-carry-over"

/**
 * Spend per budget month and category, for the budgets page's carry-over chain.
 *
 * The chain only starts at the user's earliest budget, so older transactions
 * cannot affect it. Aggregating here keeps the response a small map instead of
 * the user's entire transaction history, which used to be downloaded and
 * re-aggregated in the browser.
 */
export const GET = withUser(GET_handler)

async function GET_handler(userId: string) {

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { budgetStartDay: true },
    })
    const startDay = user?.budgetStartDay ?? 1

    const earliestBudget = await prisma.budget.findFirst({
      where: { userId },
      orderBy: { month: "asc" },
      select: { month: true },
    })

    // With no budgets there is nothing to carry over yet, but the selected
    // month still shows its spend, so fall back to the current budget month.
    const firstMonth = earliestBudget?.month ?? getCurrentBudgetMonthKey(startDay)
    const windowStart = getBudgetMonthRangeInclusive(firstMonth, startDay).start

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: windowStart },
      },
      select: { type: true, category: true, amount: true, date: true },
    })

    const spent = buildSpentByMonthCategory(transactions, startDay)

    return NextResponse.json({
      startDay,
      spentByMonthCategory: Object.fromEntries(
        [...spent].map(([month, byCategory]) => [
          month,
          Object.fromEntries(byCategory),
        ]),
      ),
    })
  } catch (error) {
    console.error("Spent-by-month error:", error)
    return NextResponse.json(
      { error: "Failed to load monthly spending" },
      { status: 500 },
    )
  }
}
