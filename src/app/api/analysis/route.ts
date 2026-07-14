import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // optional: filter by specific month

  try {
    if (month) {
      // Return a specific month's analysis
      const analysis = await prisma.monthlyAnalysis.findUnique({
        where: {
          month_userId: {
            month,
            userId: session.user.id,
          },
        },
      })

      if (!analysis) {
        return NextResponse.json(
          { error: "Analysis not found for this month" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        id: analysis.id,
        month: analysis.month,
        summary: analysis.summary,
        totalIncome: analysis.totalIncome,
        totalExpenses: analysis.totalExpenses,
        netSavings: analysis.netSavings,
        savingsRate: analysis.savingsRate,
        topCategory: analysis.topCategory,
        topCategoryAmount: analysis.topCategoryAmount,
        stockValue: analysis.stockValue,
        goldValue: analysis.goldValue,
        budgetCount: analysis.budgetCount,
        overBudgetCount: analysis.overBudgetCount,
        transactionCount: analysis.transactionCount,
        rawData: JSON.parse(analysis.rawData),
        createdAt: analysis.createdAt.toISOString(),
      })
    }

    // Return all analyses for the user (most recent first)
    const analyses = await prisma.monthlyAnalysis.findMany({
      where: { userId: session.user.id },
      orderBy: { month: "desc" },
      select: {
        id: true,
        month: true,
        totalIncome: true,
        totalExpenses: true,
        netSavings: true,
        savingsRate: true,
        topCategory: true,
        stockValue: true,
        goldValue: true,
        budgetCount: true,
        overBudgetCount: true,
        transactionCount: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      analyses: analyses.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Analysis fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    )
  }
}
