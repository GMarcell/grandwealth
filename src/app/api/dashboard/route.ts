import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  getBudgetMonthKey,
  getBudgetMonthLabel,
  getBudgetMonthRange,
  getPreviousBudgetMonthKey,
} from "@/lib/budget-months"
import { computeGoldPortfolio } from "@/lib/gold"
import { fetchGoldPriceIdr } from "@/lib/prices"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Get user's budget start day setting
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { budgetStartDay: true },
    })
    const startDay = user?.budgetStartDay ?? 1

    const currentMonthKey = getBudgetMonthKey(new Date(), startDay)
    // The previous budget month cannot be derived by subtracting one calendar
    // month from `startDay` — on any day before `startDay` that collapses to
    // the CURRENT budget month (e.g. startDay=28, today=Sep 4 → both keys are
    // "2026-08"), double-counting this period's budget and spend as rollover.
    const prevMonthKey = getPreviousBudgetMonthKey(currentMonthKey, startDay)
    const { start: monthStart, end: monthEnd } = getBudgetMonthRange(currentMonthKey, startDay)
    const { start: prevMonthStart, end: prevMonthEnd } = getBudgetMonthRange(prevMonthKey, startDay)

    // Calculate date range for fetching data (last 13 months is sufficient)
    const thirteenMonthsAgo = new Date()
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)
    thirteenMonthsAgo.setDate(1)
    thirteenMonthsAgo.setHours(0, 0, 0, 0)

    // Cutoff for the all-time cash aggregate: the end of the current calendar
    // month, which is exactly how /api/net-worth caps its "latest" cash point
    // (transactions dated after this are excluded there too).
    const allTimeNow = new Date()
    const endOfCurrentMonth = new Date(
      allTimeNow.getFullYear(),
      allTimeNow.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    )

    const [
      transactions,
      allTimeCashByType,
      goldDeposits,
      stocks,
      budgets,
      prevBudgets,
      latestAnalysis,
      categories,
      bankSavings,
      loans,
    ] = await Promise.all([
      // Fetch the full 13-month window — do NOT cap with `take`. Capping meant
      // totals, the monthly chart, budget spend, and the 50/30/20 breakdown
      // were derived from only the latest 50 transactions, silently under- (or
      // over-) counting for users with more than 50 transactions in range.
      prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: thirteenMonthsAgo },
        },
        orderBy: { date: "desc" },
      }),
      // All-time income/expense sums (single cheap DB aggregate) for the
      // hero's cash component — see allTimeNetCashflow below.
      prisma.transaction.groupBy({
        by: ["type"],
        where: {
          userId,
          date: { lte: endOfCurrentMonth },
        },
        _sum: { amount: true },
      }),
      prisma.goldDeposit.findMany({
        where: { userId },
        orderBy: { date: "desc" },
      }),
      prisma.stock.findMany({
        where: { userId },
        orderBy: { date: "desc" },
      }),
      prisma.budget.findMany({
        where: { userId, month: currentMonthKey },
      }),
      prisma.budget.findMany({
        where: { userId, month: prevMonthKey },
      }),
      prisma.monthlyAnalysis.findFirst({
        where: { userId },
        orderBy: { month: "desc" },
        select: {
          id: true,
          month: true,
          summary: true,
          totalIncome: true,
          totalExpenses: true,
          netSavings: true,
          savingsRate: true,
          overBudgetCount: true,
          createdAt: true,
        },
      }),
      prisma.category.findMany({
        where: { userId, ruleType: { not: null } },
        select: { name: true, ruleType: true },
      }),
      prisma.bankSaving.findMany({
        where: { userId },
      }),
      prisma.loan.findMany({
        where: { userId },
        select: { id: true, name: true, principal: true, remainingBalance: true, monthlyPayment: true, startDate: true },
        orderBy: { startDate: "desc" },
      }),
    ])

    // Calculate totals (full window — see the transaction query above)
    const totalIncome = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0)

    const netCashflow = totalIncome - totalExpenses

    // All-time net cash flow over the user's full transaction history. Used for
    // the hero's cash component so Total Net Wealth equals the latest point of
    // the net-worth chart (whose cash is cumulative over ALL transactions,
    // not just the 13-month window shown in the chart/cards).
    const incomeSum = allTimeCashByType.find((t) => t.type === "INCOME")?._sum.amount ?? 0
    const expenseSum = allTimeCashByType.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0
    const allTimeNetCashflow = incomeSum - expenseSum

    // Gold calculations — shared accounting helper (BUY adds weight + cost,
    // SELL removes weight + average-cost share) so gold figures never diverge
    // from the gold page, net-worth history, or AI analysis.
    const { totalWeight: totalGoldWeight, totalInvested: totalGoldInvested } =
      computeGoldPortfolio(goldDeposits)

    // Mark gold to the current market price when the user holds any — the same
    // definition /api/net-worth uses — so the dashboard's gold value (and
    // therefore total net wealth) matches the net-worth chart on the same page.
    // Falls back to the cost basis when the market fetch fails.
    let goldPricePerGram: number | null = null
    if (totalGoldWeight > 0) {
      try {
        const live = await fetchGoldPriceIdr()
        goldPricePerGram = live.pricePerGramIdr
      } catch (error) {
        console.warn(
          "Could not fetch gold price for dashboard; using cost basis",
          error,
        )
      }
    }
    const totalGoldValue =
      goldPricePerGram != null
        ? totalGoldWeight * goldPricePerGram
        : totalGoldInvested

    // Stock calculations: quantity is in lots (1 lot = 100 shares)
    // currentPrice from Yahoo Finance is per share, so multiply by 100 for per-lot value
    // buyPrice is already stored as per-lot
    const SHARES_PER_LOT = 100
    const totalStockValue = stocks.reduce(
      (sum, s) => sum + s.quantity * (s.currentPrice != null ? s.currentPrice * SHARES_PER_LOT : s.buyPrice),
      0
    )

    // Bank savings calculations
    let totalSavingsDeposits = 0
    let totalSavingsWithdrawals = 0
    for (const s of bankSavings) {
      if (s.type === "DEPOSIT") totalSavingsDeposits += s.amount
      else totalSavingsWithdrawals += s.amount
    }
    const totalSavingsValue = totalSavingsDeposits - totalSavingsWithdrawals

    // Loan / debt calculations
    const totalDebt = loans.reduce((sum, l) => sum + l.remainingBalance, 0)
    const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0)

    // Monthly aggregation for chart — bucketed by BUDGET month so a transaction
    // dated 28-31 Aug lands in the "Sep" budget month (28 Aug – 27 Sep) rather
    // than showing up under August while every other surface calls it September.
    const monthlyMap = new Map<string, { income: number; expenses: number }>()
    for (const tx of transactions) {
      const key = getBudgetMonthKey(new Date(tx.date), startDay)
      const existing = monthlyMap.get(key) || { income: 0, expenses: 0 }
      if (tx.type === "INCOME") {
        existing.income += tx.amount
      } else {
        existing.expenses += tx.amount
      }
      monthlyMap.set(key, existing)
    }

    const monthlyData = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: getBudgetMonthLabel(month, startDay),
        income: data.income,
        expenses: data.expenses,
      }))

    // Budget calculations using budget month ranges
    const monthExpenses = transactions.filter((tx) => {
      const d = new Date(tx.date)
      return tx.type === "EXPENSE" && d >= monthStart && d <= monthEnd
    })

    const expenseByCategory = new Map<string, number>()
    for (const tx of monthExpenses) {
      const current = expenseByCategory.get(tx.category) || 0
      expenseByCategory.set(tx.category, current + tx.amount)
    }

    // Previous month expense totals for rollover
    const prevMonthExpenses = transactions.filter((tx) => {
      const d = new Date(tx.date)
      return tx.type === "EXPENSE" && d >= prevMonthStart && d <= prevMonthEnd
    })

    const prevExpenseByCategory = new Map<string, number>()
    for (const tx of prevMonthExpenses) {
      const current = prevExpenseByCategory.get(tx.category) || 0
      prevExpenseByCategory.set(tx.category, current + tx.amount)
    }

    // Calculate effective budgets with rollover
    const totalBudgetAmount = budgets.reduce((sum, b) => sum + b.amount, 0)
    const totalRollover = budgets.reduce((sum, b) => {
      const prevBudget = prevBudgets.find((pb) => pb.categoryName === b.categoryName)
      if (!prevBudget) return sum
      const prevSpent = prevExpenseByCategory.get(b.categoryName) || 0
      return sum + Math.max(0, prevBudget.amount - prevSpent)
    }, 0)

    const budgetWithEffective = budgets.map((b) => {
      const prevBudget = prevBudgets.find((pb) => pb.categoryName === b.categoryName)
      const prevSpent = prevExpenseByCategory.get(b.categoryName) || 0

      // Calculate rollover: only if enabled, then cap it
      let rollover = 0
      if (b.rolloverEnabled && prevBudget) {
        const rawRollover = Math.max(0, prevBudget.amount - prevSpent)
        rollover = b.rolloverCap != null ? Math.min(rawRollover, b.rolloverCap) : rawRollover
      }

      const effectiveAmount = b.amount + rollover
      const spent = expenseByCategory.get(b.categoryName) || 0
      return { ...b, rollover, effectiveAmount, spent }
    })

    const totalBudgetSpent = budgetWithEffective
      .filter((b) => b.spent > 0)
      .reduce((sum, b) => sum + b.spent, 0)

    const totalEffectiveBudget = budgetWithEffective.reduce((sum, b) => sum + b.effectiveAmount, 0)
    const totalRemaining = totalEffectiveBudget - totalBudgetSpent

    const overBudgetEntries = budgetWithEffective
      .filter((e) => e.spent > e.effectiveAmount)
      .map((e) => ({
        categoryName: e.categoryName,
        overspent: e.spent - e.effectiveAmount,
        percentUsed: Math.round((e.spent / e.effectiveAmount) * 100),
      }))

    const nearLimitEntries = budgetWithEffective
      .filter((e) => e.spent <= e.effectiveAmount && e.effectiveAmount > 0 && (e.spent / e.effectiveAmount) >= 0.8)
      .map((e) => ({
        categoryName: e.categoryName,
        remaining: e.effectiveAmount - e.spent,
        percentUsed: Math.round((e.spent / e.effectiveAmount) * 100),
      }))

    const budgetSummary = {
      totalBudgeted: totalBudgetAmount,
      totalEffective: totalEffectiveBudget,
      totalRollover,
      totalSpent: totalBudgetSpent,
      remaining: totalRemaining,
      budgetCount: budgets.length,
      overBudget: overBudgetEntries.length,
      overBudgetEntries,
      nearLimitEntries,
    }

    // ── 50/30/20 Budget Rule Breakdown ──
    // Map category names to their rule types
    const ruleTypeMap = new Map(categories.map((c) => [c.name, c.ruleType]))

    // Get current month transactions for 50/30/20
    const currentMonthTransactions = transactions.filter((tx) => {
      const d = new Date(tx.date)
      return d >= monthStart && d <= monthEnd
    })

    const currentMonthIncome = currentMonthTransactions
      .filter((tx) => tx.type === "INCOME")
      .reduce((sum, tx) => sum + tx.amount, 0)

    const currentMonthExpenses = currentMonthTransactions.filter((tx) => tx.type === "EXPENSE")

    const totalIncomeForRule = currentMonthIncome || totalIncome

    let needsTotal = 0
    let wantsTotal = 0
    let savingsTotal = 0
    let uncategorizedTotal = 0

    for (const tx of currentMonthExpenses) {
      const ruleType = ruleTypeMap.get(tx.category)
      if (ruleType === "NEED") needsTotal += tx.amount
      else if (ruleType === "WANT") wantsTotal += tx.amount
      else if (ruleType === "SAVINGS") savingsTotal += tx.amount
      else uncategorizedTotal += tx.amount
    }

    // Also count savings from income transactions with SAVINGS rule type
    for (const tx of currentMonthTransactions.filter((tx) => tx.type === "INCOME")) {
      const ruleType = ruleTypeMap.get(tx.category)
      if (ruleType === "SAVINGS") savingsTotal += tx.amount
    }

    const targetNeeds = totalIncomeForRule * 0.5
    const targetWants = totalIncomeForRule * 0.3
    const targetSavings = totalIncomeForRule * 0.2

    const budget5050Data = totalIncomeForRule > 0
      ? {
          totalIncome: totalIncomeForRule,
          needs: { total: needsTotal, target: targetNeeds, percent: (needsTotal / totalIncomeForRule) * 100 },
          wants: { total: wantsTotal, target: targetWants, percent: (wantsTotal / totalIncomeForRule) * 100 },
          savings: { total: savingsTotal, target: targetSavings, percent: (savingsTotal / totalIncomeForRule) * 100 },
          uncategorized: { total: uncategorizedTotal, percent: (uncategorizedTotal / totalIncomeForRule) * 100 },
          categorizedCount: categories.length,
          isHealthy: needsTotal <= targetNeeds && wantsTotal <= targetWants && savingsTotal >= targetSavings,
        }
      : null

    // Recent transactions
    const recentTransactions = transactions.slice(0, 5).map((tx) => ({
      id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      description: tx.description,
      date: tx.date.toISOString(),
    }))

    return NextResponse.json({
      totalIncome,
      totalExpenses,
      netCashflow,
      allTimeNetCashflow,
      totalGoldValue,
      totalGoldWeight,
      totalStockValue,
      stockCount: stocks.length,
      totalWealth: allTimeNetCashflow + totalGoldValue + totalStockValue + totalSavingsValue - totalDebt,
      totalDebt,
      loanCount: loans.length,
      totalSavings: totalSavingsValue,
      savingsAccountCount: bankSavings.length > 0 ? new Set(bankSavings.map((s) => s.accountName)).size : 0,
      recentTransactions,
      monthlyData,
      budgetSummary,
      latestAnalysis: latestAnalysis
        ? {
            id: latestAnalysis.id,
            month: latestAnalysis.month,
            monthLabel: getBudgetMonthLabel(latestAnalysis.month, startDay),
            summary: latestAnalysis.summary,
            totalIncome: latestAnalysis.totalIncome,
            totalExpenses: latestAnalysis.totalExpenses,
            netSavings: latestAnalysis.netSavings,
            savingsRate: latestAnalysis.savingsRate,
            overBudgetCount: latestAnalysis.overBudgetCount,
            createdAt: latestAnalysis.createdAt.toISOString(),
          }
        : null,
      budget5050: budget5050Data,
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    )
  }
}
