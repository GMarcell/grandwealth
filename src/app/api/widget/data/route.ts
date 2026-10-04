import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import {
  getBudgetMonthRangeInclusive,
  getCurrentBudgetMonthKey,
  getBudgetMonthLabel,
} from "@/lib/budget-months"
import { computeGoldPortfolio } from "@/lib/gold"
import {
  resolveWidgetToken,
  WIDGET_TOKEN_HEADER,
} from "@/lib/widget-token"

// Home-screen widgets poll on a schedule, so this must never be cached.
export const dynamic = "force-dynamic"

const SHARES_PER_LOT = 100

/**
 * Compact, read-only summary for phone home-screen widgets.
 *
 * Auth is a bearer widget token (see /api/widget/tokens) rather than a session
 * cookie, because a widget script has no browser session. Tokens are read-only
 * — quick-add opens the app via a deep link instead.
 *
 * Returns only the figures the widget displays, kept small and stable so a
 * widget script does not need to change when the dashboard payload evolves.
 */
export async function GET(req: Request) {
  const token = req.headers.get(WIDGET_TOKEN_HEADER)
  const resolved = await resolveWidgetToken(token)
  if (!resolved) {
    return NextResponse.json({ error: "Invalid widget token" }, { status: 401 })
  }

  const limiter = await rateLimit(`widget:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const userId = resolved.userId

  // Widget tokens are a per-user credential, so the account's current state
  // must still be honored: a suspended account loses access here just as it
  // does on pages and session-authenticated API routes.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { budgetStartDay: true, suspended: true },
  })
  if (!user || user.suspended) {
    return NextResponse.json({ error: "Invalid widget token" }, { status: 401 })
  }

  try {
    const startDay = user.budgetStartDay ?? 1
    const monthKey = getCurrentBudgetMonthKey(startDay)
    const { start, end } = getBudgetMonthRangeInclusive(monthKey, startDay)

    const [monthTx, allTimeByType, goldDeposits, stocks, savings, loans, budgets, allTimeBudgetsTx] =
      await Promise.all([
        prisma.transaction.findMany({
          where: { userId, date: { gte: start, lte: end } },
          select: { type: true, amount: true, category: true },
        }),
        prisma.transaction.groupBy({
          by: ["type"],
          where: { userId },
          _sum: { amount: true },
        }),
        prisma.goldDeposit.findMany({
          where: { userId },
          select: { type: true, weightGram: true, totalAmount: true },
        }),
        prisma.stock.findMany({
          where: { userId },
          select: { quantity: true, buyPrice: true, currentPrice: true },
        }),
        prisma.bankSaving.findMany({
          where: { userId },
          select: { type: true, amount: true },
        }),
        prisma.loan.findMany({ where: { userId }, select: { remainingBalance: true } }),
        prisma.budget.findMany({
          where: { userId, month: monthKey },
          select: { categoryName: true, amount: true },
        }),
        // Month spend per category for remaining-budget, scoped to the
        // current budget month in SQL so we don't pull the user's entire
        // expense history into memory just to discard most of it.
        prisma.transaction.findMany({
          where: { userId, type: "EXPENSE", date: { gte: start, lte: end } },
          select: { amount: true, category: true },
        }),
      ])

    const income = monthTx
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + t.amount, 0)
    const expenses = monthTx
      .filter((t) => t.type === "EXPENSE")
      .reduce((s, t) => s + t.amount, 0)
    const netCashflow = income - expenses

    // Budget: spent per category within THIS budget month (already scoped by
    // the query above).
    const spentByCategory = new Map<string, number>()
    for (const tx of allTimeBudgetsTx) {
      spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + tx.amount)
    }
    const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0)
    const totalSpent = [...spentByCategory.values()].reduce((s, v) => s + v, 0)
    const remainingBudget = totalBudgeted - totalSpent

    // Net worth: all-time cash + gold + stocks + savings − debt.
    const incomeSum = allTimeByType.find((t) => t.type === "INCOME")?._sum.amount ?? 0
    const expenseSum = allTimeByType.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0
    const allTimeCash = incomeSum - expenseSum

    const { totalInvested: goldInvested } = computeGoldPortfolio(goldDeposits)
    const stockValue = stocks.reduce(
      (s, st) =>
        s + st.quantity * (st.currentPrice != null ? st.currentPrice * SHARES_PER_LOT : st.buyPrice),
      0,
    )
    let savingsValue = 0
    for (const s of savings) {
      savingsValue += s.type === "DEPOSIT" ? s.amount : -s.amount
    }
    const totalDebt = loans.reduce((s, l) => s + l.remainingBalance, 0)
    const netWorth = allTimeCash + goldInvested + stockValue + savingsValue - totalDebt

    return NextResponse.json({
      monthKey,
      monthLabel: getBudgetMonthLabel(monthKey, startDay),
      netCashflow,
      income,
      expenses,
      remainingBudget,
      totalBudgeted,
      totalSpent,
      netWorth,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Widget data error:", error)
    return NextResponse.json({ error: "Failed to load widget data" }, { status: 500 })
  }
}
