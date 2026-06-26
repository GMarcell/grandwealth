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
    const [
      transactions,
      goldDeposits,
      stocks,
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
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    )
  }
}
