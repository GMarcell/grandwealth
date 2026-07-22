import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBudgetMonthKey, getBudgetMonthRange } from "@/lib/budget-months"

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
    const { start: monthStart, end: monthEnd } = getBudgetMonthRange(currentMonthKey, startDay)

    // Fetch budgets for current month
    const budgets = await prisma.budget.findMany({
      where: { userId, month: currentMonthKey },
    })

    if (budgets.length === 0) {
      return NextResponse.json({ overBudget: 0 })
    }

    // Fetch only expenses within the budget month range
    const monthExpenses = await prisma.transaction.findMany({
      where: {
        userId,
        type: "EXPENSE",
        date: { gte: monthStart, lte: monthEnd },
      },
    })

    // Calculate spending by category
    const expenseByCategory = new Map<string, number>()
    for (const tx of monthExpenses) {
      const current = expenseByCategory.get(tx.category) || 0
      expenseByCategory.set(tx.category, current + tx.amount)
    }

    // Count over-budget categories
    let overBudget = 0
    for (const budget of budgets) {
      const spent = expenseByCategory.get(budget.categoryName) || 0
      if (spent > budget.amount) overBudget++
    }

    return NextResponse.json({ overBudget })
  } catch {
    return NextResponse.json({ overBudget: 0 })
  }
}
