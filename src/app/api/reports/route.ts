import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const monthsParam = searchParams.get("months")
  const monthsBack = Math.min(Math.max(parseInt(monthsParam || "12"), 1), 24)

  const userId = session.user.id

  try {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    })

    // Spending by category (current month)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const currentExpenses = transactions.filter(
      (tx) => tx.type === "EXPENSE" && tx.date >= currentMonthStart && tx.date <= currentMonthEnd
    )

    const spendingByCategory = new Map<string, number>()
    for (const tx of currentExpenses) {
      const current = spendingByCategory.get(tx.category) || 0
      spendingByCategory.set(tx.category, current + tx.amount)
    }

    // Monthly breakdown
    const monthlyMap = new Map<
      string,
      { income: number; expenses: number; count: number }
    >()

    for (const tx of transactions) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const existing = monthlyMap.get(key) || { income: 0, expenses: 0, count: 0 }
      if (tx.type === "INCOME") {
        existing.income += tx.amount
      } else {
        existing.expenses += tx.amount
      }
      existing.count++
      monthlyMap.set(key, existing)
    }

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const [year, m] = month.split("-")
        return {
          month,
          label: `${monthNames[parseInt(m) - 1]} ${year}`,
          income: data.income,
          expenses: data.expenses,
          net: data.income - data.expenses,
          transactionCount: data.count,
        }
      })

    // Category breakdown (for the whole period)
    const incomeByCategory = new Map<string, number>()
    const expenseByCategory = new Map<string, number>()

    for (const tx of transactions) {
      if (tx.type === "INCOME") {
        const current = incomeByCategory.get(tx.category) || 0
        incomeByCategory.set(tx.category, current + tx.amount)
      } else {
        const current = expenseByCategory.get(tx.category) || 0
        expenseByCategory.set(tx.category, current + tx.amount)
      }
    }

    const categoryBreakdown = {
      income: Array.from(incomeByCategory.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      expense: Array.from(expenseByCategory.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
    }

    // Averages
    const totalIncome = transactions
      .filter((tx) => tx.type === "INCOME")
      .reduce((sum, tx) => sum + tx.amount, 0)

    const totalExpenses = transactions
      .filter((tx) => tx.type === "EXPENSE")
      .reduce((sum, tx) => sum + tx.amount, 0)

    const monthsInRange = monthlyBreakdown.length || 1

    // Top spending categories this month
    const topSpending = Array.from(spendingByCategory.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      summary: {
        totalIncome,
        totalExpenses,
        netCashflow: totalIncome - totalExpenses,
        avgMonthlyIncome: Math.round(totalIncome / monthsInRange),
        avgMonthlyExpenses: Math.round(totalExpenses / monthsInRange),
        avgMonthlyNet: Math.round((totalIncome - totalExpenses) / monthsInRange),
        monthsInRange,
        totalTransactions: transactions.length,
      },
      monthlyBreakdown,
      currentMonthSpending: topSpending,
      categoryBreakdown,
      currentMonth: {
        incomeTotal: transactions
          .filter((tx) => tx.type === "INCOME" && tx.date >= currentMonthStart && tx.date <= currentMonthEnd)
          .reduce((sum, tx) => sum + tx.amount, 0),
        expenseTotal: currentExpenses.reduce((sum, tx) => sum + tx.amount, 0),
      },
    })
  } catch (error) {
    console.error("Reports error:", error)
    return NextResponse.json(
      { error: "Failed to load reports" },
      { status: 500 }
    )
  }
}
