import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import {
  buildDividendCalendar,
  fetchStockDividendInfos,
  type CalendarProjectionInput,
} from "@/lib/dividends"
import { SHARES_PER_LOT } from "@/lib/wealth-history"

/**
 * GET /api/dividends/upcoming
 *
 * Projects dividend income for the stocks a user holds, using dividend history
 * published by Yahoo Finance (the same source as our live prices).
 *
 * Yahoo does not publish announced forward dividend dates for IDX tickers, so
 * the next date is inferred from the payer's recent cadence and everything here
 * is an estimate. Amounts are derived from the last actual payment and from the
 * trailing 12-month total per share, never invented.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Stocks are a Pro module, and this endpoint fans out to Yahoo per holding.
  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const limiter = await rateLimit(`dividends-upcoming:${getRateLimitKey(req)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const stocks = await prisma.stock.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    })

    // A user can hold the same symbol in several rows (one per purchase), while
    // dividends are paid per share — so aggregate the lots per symbol first.
    interface Holding {
      symbol: string
      name: string
      lots: number
      cost: number
      /** Most recent row for the symbol — used when the user records a payout. */
      primaryStockId: string
    }

    const holdings = new Map<string, Holding>()
    for (const stock of stocks) {
      const symbol = stock.symbol.trim().toUpperCase()
      const existing = holdings.get(symbol)
      if (existing) {
        existing.lots += stock.quantity
        existing.cost += stock.quantity * stock.buyPrice
      } else {
        // Rows are ordered newest first, so the first one wins as primary.
        holdings.set(symbol, {
          symbol,
          name: stock.name,
          lots: stock.quantity,
          cost: stock.quantity * stock.buyPrice,
          primaryStockId: stock.id,
        })
      }
    }

    const dividendInfos = await fetchStockDividendInfos([...holdings.keys()])

    const data: Array<{
      symbol: string
      name: string
      stockId: string
      lots: number
      shares: number
      currency: string
      frequency: string
      estimatedNextExDate: string | null
      /** Per-share amount of the most recent actual payment. */
      lastDividendPerShare: number | null
      lastDividendDate: string | null
      /** Actual per-share total over the trailing 12 months. */
      trailingDividendPerShare: number | null
      dividendYield: number | null
      estimatedNextPayout: number | null
      estimatedAnnualIncome: number | null
      yieldOnCost: number | null
      history: { date: string; amountPerShare: number }[]
    }> = []

    // Inputs for the 12-month cashflow calendar, filled in the same pass.
    const calendarInputs: CalendarProjectionInput[] = []

    let holdingsWithoutData = 0

    for (const holding of holdings.values()) {
      const info = dividendInfos.get(holding.symbol)
      if (!info) {
        holdingsWithoutData++
        continue
      }

      const shares = holding.lots * SHARES_PER_LOT

      // Size a single payment from the trailing average rather than the last
      // payment: IDX payers often pay one large annual dividend plus small
      // interims, so the most recent amount alone is a poor predictor.
      const amountPerPayment =
        info.trailingDividendPerShare != null && info.trailingPaymentCount > 0
          ? info.trailingDividendPerShare / info.trailingPaymentCount
          : info.lastDividendPerShare

      calendarInputs.push({
        symbol: holding.symbol,
        name: holding.name,
        lots: holding.lots,
        shares,
        amountPerPayment,
        estimatedNextExDate: info.estimatedNextExDate,
        medianGapDays: info.medianGapDays,
      })
      const estimatedNextPayout =
        info.lastDividendPerShare != null ? Math.round(info.lastDividendPerShare * shares) : null
      const estimatedAnnualIncome =
        info.trailingDividendPerShare != null
          ? Math.round(info.trailingDividendPerShare * shares)
          : null

      data.push({
        symbol: holding.symbol,
        name: holding.name,
        stockId: holding.primaryStockId,
        lots: holding.lots,
        shares,
        currency: info.currency,
        frequency: info.frequency,
        estimatedNextExDate: info.estimatedNextExDate,
        lastDividendPerShare: info.lastDividendPerShare,
        lastDividendDate: info.lastDividendDate,
        trailingDividendPerShare: info.trailingDividendPerShare,
        dividendYield: info.dividendYield,
        estimatedNextPayout,
        estimatedAnnualIncome,
        yieldOnCost:
          holding.cost > 0 && estimatedAnnualIncome != null
            ? estimatedAnnualIncome / holding.cost
            : null,
        history: info.history.slice(0, 6),
      })
    }

    // Soonest payment first; anything without a projected date falls to the end.
    data.sort((a, b) => {
      if (a.estimatedNextExDate && b.estimatedNextExDate) {
        return a.estimatedNextExDate.localeCompare(b.estimatedNextExDate)
      }
      if (a.estimatedNextExDate) return -1
      if (b.estimatedNextExDate) return 1
      return (b.estimatedAnnualIncome ?? 0) - (a.estimatedAnnualIncome ?? 0)
    })

    return NextResponse.json({
      data,
      calendar: buildDividendCalendar(calendarInputs),
      totals: {
        estimatedNextPayout: data.reduce((sum, d) => sum + (d.estimatedNextPayout ?? 0), 0),
        estimatedAnnualIncome: data.reduce(
          (sum, d) => sum + (d.estimatedAnnualIncome ?? 0),
          0
        ),
        holdingsWithDividends: data.length,
        holdingsWithoutData,
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Upcoming dividends error:", error)
    return NextResponse.json({ error: "Failed to fetch dividend data" }, { status: 500 })
  }
}
