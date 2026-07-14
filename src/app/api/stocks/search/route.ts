import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance()

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`stocks-search:${getRateLimitKey(req)}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const query = req.nextUrl.searchParams.get("q")?.trim()
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const result = await yahooFinance.search(query, {
      quotesCount: 8,
      newsCount: 0,
      enableEnhancedTrivialQuery: false,
    })

    const quotes = (result as any).quotes ?? []
    const stocks = quotes
      .filter((q: any) => q.quoteType === "EQUITY" && q.symbol)
      .map((q: any) => ({
        // Strip .JK suffix from IDX stocks so symbols are stored clean (e.g., "ANTM.JK" → "ANTM")
        symbol: q.symbol.replace(/\.JK$/, ""),
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || "",
      }))

    return NextResponse.json({ results: stocks })
  } catch (error) {
    console.error("Stock search error:", error)
    return NextResponse.json({ results: [] })
  }
}
