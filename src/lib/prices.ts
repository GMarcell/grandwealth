import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance()

export interface GoldPriceResult {
  pricePerGramIdr: number
  pricePerOunceIdr: number
  pricePerOunceUsd: number
  usdIdrRate: number
  updatedAt: string
}

export interface StockPriceResult {
  symbol: string
  price: number
  currency: string
}

interface QuoteData {
  regularMarketPrice?: number
  regularMarketPreviousClose?: number
  symbol?: string
  currency?: string
}

/**
 * Safely extract regularMarketPrice from a Quote-like object.
 */
function getPrice(quote: QuoteData): number | undefined {
  return quote?.regularMarketPrice ?? undefined
}

/**
 * Safely extract regularMarketPreviousClose from a Quote-like object.
 */
function getPreviousClose(quote: QuoteData): number | undefined {
  return quote?.regularMarketPreviousClose ?? undefined
}

/**
 * Get the best available price: prefer live regularMarketPrice, fall back to
 * regularMarketPreviousClose (e.g., when the market is closed).
 */
function getPriceWithFallback(quote: QuoteData): number | undefined {
  return getPrice(quote) ?? getPreviousClose(quote) ?? undefined
}

function getSymbol(quote: QuoteData): string | undefined {
  return quote?.symbol ?? undefined
}

function getCurrency(quote: QuoteData): string | undefined {
  return quote?.currency ?? undefined
}

let cachedGoldPrice: { value: GoldPriceResult; expiresAt: number } | null = null

/**
 * Fetch the current gold spot price in IDR per gram.
 * Uses GC=F (Gold Futures) for the gold price and IDR=X for USD/IDR exchange rate.
 *
 * @param options.maxAgeMs Reuse the last successful quote while it is younger
 *   than this. Read paths (dashboard, net worth) pass a few minutes so a page
 *   load never blocks on Yahoo Finance; the price cron passes nothing and
 *   always fetches live.
 */
export async function fetchGoldPriceIdr(
  options: { maxAgeMs?: number } = {},
): Promise<GoldPriceResult> {
  const { maxAgeMs = 0 } = options
  if (maxAgeMs > 0 && cachedGoldPrice && cachedGoldPrice.expiresAt > Date.now()) {
    return cachedGoldPrice.value
  }

  const [goldQuote, usdIdrQuote] = await Promise.all([
    yahooFinance.quote("GC=F") as unknown as QuoteData,
    yahooFinance.quote("IDR=X") as unknown as QuoteData,
  ])

  const pricePerOunceUsd = getPrice(goldQuote) ?? 0
  const usdIdrRate = getPrice(usdIdrQuote) ?? 0

  // 1 troy ounce = 31.1035 grams
  const pricePerGramIdr = (pricePerOunceUsd / 31.1035) * usdIdrRate
  const pricePerOunceIdr = pricePerOunceUsd * usdIdrRate

  const result: GoldPriceResult = {
    pricePerGramIdr: Math.round(pricePerGramIdr),
    pricePerOunceIdr: Math.round(pricePerOunceIdr),
    pricePerOunceUsd: pricePerOunceUsd,
    usdIdrRate: usdIdrRate,
    updatedAt: new Date().toISOString(),
  }

  if (maxAgeMs > 0) {
    cachedGoldPrice = { value: result, expiresAt: Date.now() + maxAgeMs }
  }

  return result
}

/**
 * Fetch the current price for a stock symbol (with .JK suffix for IDX stocks).
 */
export async function fetchStockPrice(symbol: string): Promise<StockPriceResult | null> {
  try {
    // Append .JK if not already present (IDX stocks on Yahoo Finance)
    const yahooSymbol = symbol.includes(".") ? symbol : `${symbol}.JK`
    const quote = await yahooFinance.quote(yahooSymbol) as unknown as QuoteData
    const price = getPriceWithFallback(quote)
    if (price == null) return null
    return {
      symbol,
      price,
      currency: getCurrency(quote) ?? "IDR",
    }
  } catch (error) {
    console.error(`Failed to fetch price for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch current prices for multiple stock symbols in parallel.
 */
export async function fetchStockPrices(symbols: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>()
  const uniqueSymbols = [...new Set(symbols)]

  // Build a mapping: Yahoo Finance symbol → original stored symbol
  // This handles both stored formats: "ANTM" and "ANTM.JK"
  const yahooToOriginal = new Map<string, string>()
  for (const s of uniqueSymbols) {
    const yahooSym = s.includes(".") ? s : `${s}.JK`
    yahooToOriginal.set(yahooSym, s)
  }

  // Yahoo Finance allows batch quotes
  try {
    const yahooSymbols = [...yahooToOriginal.keys()]
    const quotes = await yahooFinance.quote(yahooSymbols) as unknown as QuoteData | QuoteData[]

    const quoteArray = Array.isArray(quotes) ? quotes : [quotes]
    for (const q of quoteArray) {
      const price = getPriceWithFallback(q)
      const sym = getSymbol(q)
      if (price != null && sym) {
        // Map back to the original stored symbol
        const originalSymbol = yahooToOriginal.get(sym)
        if (originalSymbol) {
          results.set(originalSymbol, price)
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch stock prices:", error)
  }

  return results
}
