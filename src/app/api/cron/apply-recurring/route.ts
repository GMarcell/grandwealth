import { NextResponse } from "next/server"
import { applyDueRecurringTransactions } from "@/lib/recurring"

/**
 * Cron endpoint that converts due recurring transactions into real
 * Transaction records, then advances their nextDate.
 *
 * Intended to run daily (e.g. 00:30 UTC = 07:30 WIB).
 *
 * Setup:
 *   - Vercel Cron: add to vercel.json with CRON_SECRET configured
 *   - Linux cron: curl -H "Authorization: Bearer YOUR_SECRET" \
 *       https://yourdomain.com/api/cron/apply-recurring
 */
export async function GET(request: Request) {
  // Verify cron secret if configured.
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

  try {
    const { created, deactivated } = await applyDueRecurringTransactions()
    return NextResponse.json({
      message: `Created ${created} transaction(s) from recurring schedules`,
      created,
      deactivated,
      at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron apply recurring error:", error)
    return NextResponse.json(
      { error: "Failed to apply recurring transactions" },
      { status: 500 }
    )
  }
}
