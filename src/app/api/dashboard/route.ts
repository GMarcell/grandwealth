import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const currentMonth = new Date()
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`

    const [
      transactions,
      goldDeposits,
      stocks,
      budgets,
      prevBudgets,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 50,
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
        where: { userId, month: monthKey },
      }),
      prisma.budget.findMany({
        where: { userId, month: prevMonthKey },
      }),
    ])

    // Calculate totals
    const totalIncome = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0)

    const netCashflow = totalIncome - totalExpenses

    // Gold calculations
    let totalGoldWeight = 0
    let totalGoldInvested = 0
    for (const g of goldDeposits) {
      if (g.type === "BUY") {
        totalGoldWeight += g.weightGram
        totalGoldInvested += g.totalAmount
      } else {
        totalGoldWeight -= g.weightGram
      }
    }

    // Stock calculations
    const totalStockValue = stocks.reduce(
      (sum, s) => sum + s.quantity * s.buyPrice,
      0
    )

    // Monthly aggregation for chart
    const monthlyMap = new Map<string, { income: number; expenses: number }>()
    for (const tx of transactions) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
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
      .map(([month, data]) => {
        const [year, m] = month.split("-")
        const monthNames = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ]
        return {
          month: `${monthNames[parseInt(m) - 1]} ${year}`,
          income: data.income,
          expenses: data.expenses,
        }
      })

    // Budget calculations
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

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
    const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)
    const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0)

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
      totalGoldValue: totalGoldInvested,
      totalGoldWeight,
      totalStockValue,
      stockCount: stocks.length,
      totalWealth: netCashflow + totalGoldInvested + totalStockValue,
      recentTransactions,
      monthlyData,
      budgetSummary,
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    )
  }
}
