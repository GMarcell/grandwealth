import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { generateAnalysisForUserAndMonth } from "@/lib/analysis-generator"
import { getLastCompletedBudgetMonthKey } from "@/lib/budget-months"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import {
  checkGroqQuota,
  consumeGroqQuota,
  PRO_GROQ_MONTHLY_LIMIT,
  serializeQuotaRemaining,
} from "@/lib/ai-usage-quota"

export async function GET(req: Request) {
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") // optional: filter by specific month

  try {
    if (month) {
      // Return a specific month's analysis
      const analysis = await prisma.monthlyAnalysis.findUnique({
        where: {
          month_userId: {
            month,
            userId: userId,
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
      where: { userId: userId },
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
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

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

  // Reject a budget month that is still running. A report for an incomplete
  // period would be built from partial data, so only completed budget months
  // may be generated. Budget-month keys sort lexicographically, so a key after
  // the last completed month's key is still in progress.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { budgetStartDay: true },
  })
  const lastCompletedMonthKey = getLastCompletedBudgetMonthKey(
    user?.budgetStartDay ?? 1
  )
  if (month > lastCompletedMonthKey) {
    return NextResponse.json(
      {
        error:
          "This budget month is not complete yet. Analysis is only available for completed budget months.",
      },
      { status: 400 }
    )
  }

  // Short-term rate limit: max 3 regenerations per 60 seconds per user.
  const rateLimitKey = `analysis:regenerate:${getRateLimitKey(req)}:${userId}`
  const shortLimit = await rateLimit(rateLimitKey, {
    limit: 3,
    windowMs: 60_000,
  })

  if (!shortLimit.allowed) {
    const retryAfter = Math.ceil((shortLimit.resetTime - Date.now()) / 1000)
    return NextResponse.json(
      {
        error: `Too many regeneration requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": "3",
          "X-RateLimit-Remaining": String(0),
          "X-RateLimit-Reset": String(shortLimit.resetTime),
        },
      }
    )
  }

  // Monthly Groq AI usage quota. Pro accounts are capped at
  // PRO_GROQ_MONTHLY_LIMIT Groq invocations per calendar month; Pro+ and admin
  // accounts are not capped.
  const quota = await checkGroqQuota(userId)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You have reached your monthly Groq AI limit. You can generate ${PRO_GROQ_MONTHLY_LIMIT} AI analyses per month on the Pro plan. Your quota resets at the start of the next month.`,
        retryAfter: Math.ceil(
          (new Date(quota.resetAt).getTime() - Date.now()) / 1000,
        ),
        resetAt: quota.resetAt,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(
            (new Date(quota.resetAt).getTime() - Date.now()) / 1000,
          )),
          "X-GroqQuota-Limit": String(quota.limit),
          "X-GroqQuota-Remaining": String(quota.remaining),
          "X-GroqQuota-Reset": quota.resetAt,
        },
      },
    )
  }

  try {
    const result = await generateAnalysisForUserAndMonth(userId, month)

    // Burn one monthly Groq quota token after the Groq call succeeds, so a
    // request that fails before reaching Groq does not consume quota.
    const remaining = await consumeGroqQuota(userId)

    return NextResponse.json(
      {
        message: "Analysis regenerated successfully",
        analysis: result,
        quota: {
          remaining: serializeQuotaRemaining(remaining),
          resetAt: new Date(quota.resetAt).toISOString(),
          limit: quota.limit,
        },
      },
      {
        headers: {
          "X-RateLimit-Limit": "3",
          "X-RateLimit-Remaining": String(shortLimit.remaining - 1),
          "X-RateLimit-Reset": String(shortLimit.resetTime),
          "X-GroqQuota-Limit": String(quota.limit),
          "X-GroqQuota-Remaining": String(remaining),
          "X-GroqQuota-Reset": quota.resetAt,
        },
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
