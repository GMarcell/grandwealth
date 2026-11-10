import { NextResponse } from "next/server"
import { sendDailyAlerts } from "@/lib/alerts"
import { verifyCronSecret } from "@/lib/cron-auth"

/**
 * Cron endpoint that emails opted-in users their daily digest of upcoming
 * recurring bills and budgets nearing (or over) their limit.
 *
 * Intended to run daily AFTER `apply-recurring` — bills due today are already
 * recorded as transactions by then, so the digest only advertises what is
 * still ahead.
 *
 * Setup:
 *   - Vercel Cron: add to vercel.json with CRON_SECRET configured
 *   - Linux cron: curl -H "Authorization: Bearer YOUR_SECRET" \
 *       https://yourdomain.com/api/cron/daily-alerts
 */
export async function GET(request: Request) {
  // Fail closed: without CRON_SECRET there is no way to authorize a caller, so
  // the endpoint must not run at all.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }

  if (!verifyCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await sendDailyAlerts()
    return NextResponse.json({
      message: `Sent ${result.emailsSent} alert email(s)`,
      ...result,
      at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron daily alerts error:", error)
    return NextResponse.json(
      { error: "Failed to send daily alerts" },
      { status: 500 }
    )
  }
}
