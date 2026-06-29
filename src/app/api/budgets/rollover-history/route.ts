import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getMonthLabel(month: string): string {
  const [year, m] = month.split("-")
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  return `${monthNames[parseInt(m) - 1]} ${year.slice(2)}`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // Get last 13 months of budgets (12 months + 1 extra for proper rollover calc)
    const months: string[] = []
    const now = new Date()
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(getMonthKey(d))
    }

    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        month: { in: months },
      },
      orderBy: [{ categoryName: "asc" }, { month: "asc" }],
    })

    // Get all transactions (last 13 months + current)
    const startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    })

    // Index transactions by month + category
    const expenseByMonthCategory = new Map<string, Map<string, number>>()
    for (const tx of transactions) {
      const monthKey = getMonthKey(tx.date)
      if (!expenseByMonthCategory.has(monthKey)) {
        expenseByMonthCategory.set(monthKey, new Map())
      }
      const catMap = expenseByMonthCategory.get(monthKey)!
      const current = catMap.get(tx.category) || 0
      catMap.set(tx.category, current + tx.amount)
    }

    // Get unique category names that have budgets
    const categoryNames = [...new Set(budgets.map((b) => b.categoryName))].sort()

    // Compute rollover history for each category
    const categories = categoryNames.map((categoryName) => {
      const monthEntries: Array<{
        month: string
        monthLabel: string
        budgetAmount: number
        spent: number
        rolloverReceived: number
        unused: number
        rolloverEnabled: boolean
        rolloverCap: number | null
        effectiveBudget: number
      }> = []

      let previousUnused = 0

      for (const month of months) {
        const budget = budgets.find(
          (b) => b.categoryName === categoryName && b.month === month
        )

        if (!budget) {
          // No budget for this month, rollover resets
          previousUnused = 0
          continue
        }

        const spent = expenseByMonthCategory.get(month)?.get(categoryName) || 0
        const rolloverEnabled = budget.rolloverEnabled
        const rolloverCap = budget.rolloverCap

        // Calculate rollover received (previous month's unused, respecting toggle and cap)
        let rolloverReceived = 0
        if (rolloverEnabled && previousUnused > 0) {
          const rawRollover = previousUnused
          rolloverReceived = rolloverCap != null ? Math.min(rawRollover, rolloverCap) : rawRollover
        }

        const effectiveBudget = budget.amount + rolloverReceived
        const unused = Math.max(0, effectiveBudget - spent)

        monthEntries.push({
          month,
          monthLabel: getMonthLabel(month),
          budgetAmount: budget.amount,
          spent,
          rolloverReceived,
          unused,
          rolloverEnabled,
          rolloverCap,
          effectiveBudget,
        })

        // Carry forward unused amount for next month's rollover
        previousUnused = rolloverEnabled ? unused : 0
      }

      // Filter to only show months that have data (remove trailing empty months)
      const firstBudgetIndex = monthEntries.findIndex((e) => e.budgetAmount > 0)
      const filtered = firstBudgetIndex >= 0 ? monthEntries.slice(firstBudgetIndex) : []

      return {
        categoryName: categoryName.replace("_", " "),
        months: filtered,
      }
    })

    // Filter to only categories with data
    const categoriesWithData = categories.filter((c) => c.months.length > 0)

    return NextResponse.json({
      months: months.map((m) => ({ key: m, label: getMonthLabel(m) })),
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
