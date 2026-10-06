import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fetchStockPrices } from "@/lib/prices"
import { expireLapsedTrials } from "@/lib/trial"
import { verifyCronSecret } from "@/lib/cron-auth"

/**
 * Cron endpoint to update stock prices for ALL users.
 * Intended to be called on a schedule (e.g., at market open ~9:15 AM and close ~4:00 PM WIB).
 *
 * Setup options:
 *   - **Vercel Cron Jobs**: Set CRON_SECRET env var in Vercel dashboard.
 *     Vercel automatically sends Authorization: Bearer CRON_SECRET.
 *   - **Linux cron**: `curl -H "Authorization: Bearer YOUR_SECRET" https://yourdomain.com/api/cron/update-prices`
 *   - **Cron-job.org, etc**: send the secret as an `Authorization: Bearer` header
 *
 * Schedule (WIB = UTC+7):
 *   - Market open:  02:15 UTC = 09:15 WIB  →  cron: "15 2 * * *"
 *   - Market close: 09:00 UTC = 16:00 WIB  →  cron: "0 9 * * *"
 */
export async function GET(request: Request) {
  // Fail closed: CRON_SECRET must be configured, otherwise there is no way to
  // authorize a caller and the endpoint would run unauthenticated.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }

  // Verify the caller's Bearer secret in constant time.
  if (!verifyCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()

    // Housekeeping: end any lapsed trials before computing who to
    // refresh prices for.
    await expireLapsedTrials(now)

    // Stock tracking is a Pro feature — only refresh prices for users with an
    // active subscription (ex-subscribers' prices freeze until they renew).
    const stocks = await prisma.stock.findMany({
      where: {
        user: {
          // Either paid tier is entitled (Pro+ is a superset of Pro).
          plan: { in: ["PRO", "PRO_PLUS"] },
          subscriptionStatus: "ACTIVE",
          suspended: false,
          OR: [
            { currentPeriodEnd: null },
            { currentPeriodEnd: { gt: now } },
          ],
        },
      },
      select: { id: true, symbol: true },
    })

    if (stocks.length === 0) {
      return NextResponse.json({ message: "No stocks to update", count: 0 })
    }

    const symbols = [...new Set(stocks.map((s) => s.symbol))]
    const prices = await fetchStockPrices(symbols)

    let updatedCount = 0

    for (const stock of stocks) {
      const price = prices.get(stock.symbol)
      if (price != null) {
        await prisma.stock.update({
          where: { id: stock.id },
          data: {
            currentPrice: price,
            lastPriceUpdated: now,
          },
        })
        updatedCount++
      }
    }

    return NextResponse.json({
      message: "Stock prices updated for all users",
      count: updatedCount,
      total: stocks.length,
      updatedAt: now.toISOString(),
    })
  } catch (error) {
    console.error("Cron update prices error:", error)
    return NextResponse.json(
      { error: "Failed to update prices" },
      { status: 500 }
    )
  }
}
