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

/**
 * Safely extract regularMarketPrice from a Quote-like object.
 */
function getPrice(quote: any): number | undefined {
  return quote?.regularMarketPrice ?? undefined
}

function getSymbol(quote: any): string | undefined {
  return quote?.symbol ?? undefined
}

function getCurrency(quote: any): string | undefined {
  return quote?.currency ?? undefined
}

/**
 * Fetch the current gold spot price in IDR per gram.
 * Uses GC=F (Gold Futures) for the gold price and IDR=X for USD/IDR exchange rate.
 */
export async function fetchGoldPriceIdr(): Promise<GoldPriceResult> {
  const [goldQuote, usdIdrQuote] = await Promise.all([
    yahooFinance.quote("GC=F") as any,
    yahooFinance.quote("IDR=X") as any,
  ])

  const pricePerOunceUsd = getPrice(goldQuote) ?? 0
  const usdIdrRate = getPrice(usdIdrQuote) ?? 0

  // 1 troy ounce = 31.1035 grams
  const pricePerGramIdr = (pricePerOunceUsd / 31.1035) * usdIdrRate
  const pricePerOunceIdr = pricePerOunceUsd * usdIdrRate

  return {
    pricePerGramIdr: Math.round(pricePerGramIdr),
    pricePerOunceIdr: Math.round(pricePerOunceIdr),
    pricePerOunceUsd: pricePerOunceUsd,
    usdIdrRate: usdIdrRate,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Fetch the current price for a stock symbol (with .JK suffix for IDX stocks).
 */
export async function fetchStockPrice(symbol: string): Promise<StockPriceResult | null> {
  try {
    // Append .JK if not already present (IDX stocks on Yahoo Finance)
    const yahooSymbol = symbol.includes(".") ? symbol : `${symbol}.JK`
    const quote = await yahooFinance.quote(yahooSymbol) as any
    const price = getPrice(quote)
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
    const quotes = await yahooFinance.quote(yahooSymbols) as any

    const quoteArray = Array.isArray(quotes) ? quotes : [quotes]
    for (const q of quoteArray) {
      const price = getPrice(q)
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
