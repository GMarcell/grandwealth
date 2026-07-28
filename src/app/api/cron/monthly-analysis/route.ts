import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateAnalysisForUserAndMonth } from "@/lib/analysis-generator"

/**
 * Cron endpoint to generate a monthly spending & savings analysis for every user
 * using Groq AI. Intended to run at the end of each calendar month.
 *
 * Setup options:
 *   - **Vercel Cron Jobs**: Set CRON_SECRET & GROQ_API_KEY env vars in Vercel dashboard.
 *   - **Linux cron**: `curl -H "Authorization: Bearer YOUR_SECRET" https://yourdomain.com/api/cron/monthly-analysis`
 *   - **Cron-job.org, etc**: Pass as query param `?secret=YOUR_SECRET`
 *
 * Schedule: Runs on the last day of every month at 23:30 UTC.
 *   cron: "30 23 28-31 * *" (Vercel will run it only on the last day)
 */
export async function GET(request: Request) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null
    const url = new URL(request.url)
    const querySecret = url.searchParams.get("secret")
    const providedSecret = bearerToken ?? querySecret

    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Check for Groq API key
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    // Determine the month to analyze (the month that just ended).
    // The cron runs at 23:30 on the last calendar day of the month.
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, budgetStartDay: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ message: "No users found", count: 0 })
    }

    let analyzedCount = 0
    const errors: Array<{ userId: string; error: string }> = []

    for (const user of users) {
      try {
        await generateAnalysisForUserAndMonth(user.id, monthKey)
        analyzedCount++
      } catch (userError) {
        console.error(`Error analyzing for user ${user.id}:`, userError)
        errors.push({
          userId: user.id,
          error: userError instanceof Error ? userError.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      message: `Monthly analysis generated for ${analyzedCount} users`,
      month: monthKey,
      count: analyzedCount,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Cron monthly analysis error:", error)
    return NextResponse.json(
      { error: "Failed to generate monthly analysis" },
      { status: 500 }
    )
  }
}
