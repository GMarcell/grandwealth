import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateAnalysisForUserAndMonth } from "@/lib/analysis-generator"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

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

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let month: string

  try {
    const body = await req.json()
    month = body.month
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!month || typeof month !== "string") {
    return NextResponse.json(
      { error: "Month parameter is required (format: YYYY-MM)" },
      { status: 400 }
    )
  }

  // Validate month format: YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Invalid month format. Use YYYY-MM" },
      { status: 400 }
    )
  }

  // Rate limit: max 3 regenerations per 60 seconds per user
  const rateLimitKey = `analysis:regenerate:${getRateLimitKey(req)}:${session.user.id}`
  const { allowed, remaining, resetTime } = await rateLimit(rateLimitKey, {
    limit: 3,
    windowMs: 60_000,
  })

  const rateLimitHeaders = {
    "X-RateLimit-Limit": "3",
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetTime),
  }

  if (!allowed) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: `Too many regeneration requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          ...rateLimitHeaders,
        },
      }
    )
  }

  try {
    const result = await generateAnalysisForUserAndMonth(session.user.id, month)

    return NextResponse.json(
      {
        message: "Analysis regenerated successfully",
        analysis: result,
      },
      {
        headers: rateLimitHeaders,
      }
    )
  } catch (error) {
    console.error("Analysis regeneration error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to regenerate analysis",
      },
      { status: 500 }
    )
  }
}
