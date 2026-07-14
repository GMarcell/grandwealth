import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock YahooFinance before importing the module under test.
// vi.hoisted runs before vi.mock so the mockQuote reference is available.
const { mockQuote } = vi.hoisted(() => ({
  mockQuote: vi.fn(),
}))

vi.mock("yahoo-finance2", () => ({
  default: vi.fn(function () {
    return { quote: mockQuote }
  }),
}))

// Now import the functions — by this point yahoo-finance2 is already mocked.
// The module-level `new YahooFinance()` will call the mocked constructor,
// so yahooFinance.quote inside prices.ts === mockQuote.
import { fetchStockPrice, fetchStockPrices } from "../prices"

// ─── Helpers ──────────────────────────────────────

function makeQuote(overrides: Partial<{
  symbol: string
  regularMarketPrice: number | null | undefined
  regularMarketPreviousClose: number | null | undefined
  currency: string
}> = {}) {
  return {
    symbol: "ANTM.JK",
    regularMarketPrice: 5000,
    regularMarketPreviousClose: 4900,
    currency: "IDR",
    ...overrides,
  }
}

// ─── fetchStockPrice ─────────────────────────────

describe("fetchStockPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns live price for a clean symbol (appends .JK automatically)", async () => {
    mockQuote.mockResolvedValueOnce(makeQuote({ symbol: "ANTM.JK", regularMarketPrice: 5050, currency: "IDR" }))

    const result = await fetchStockPrice("ANTM")

    expect(result).not.toBeNull()
    expect(result!.symbol).toBe("ANTM")
    expect(result!.price).toBe(5050)
    expect(result!.currency).toBe("IDR")
    // Should have queried with .JK appended
    expect(mockQuote).toHaveBeenCalledWith("ANTM.JK")
  })

  it("handles a symbol that already has .JK suffix", async () => {
    mockQuote.mockResolvedValueOnce(makeQuote({ symbol: "ANTM.JK", regularMarketPrice: 5100 }))

    const result = await fetchStockPrice("ANTM.JK")

    expect(result).not.toBeNull()
    expect(result!.symbol).toBe("ANTM.JK")
    expect(result!.price).toBe(5100)
    // Should NOT append another .JK
    expect(mockQuote).toHaveBeenCalledWith("ANTM.JK")
  })

  it("falls back to previous close when regularMarketPrice is undefined (market closed)", async () => {
    // Market is closed — no live price, but previous close is available
    mockQuote.mockResolvedValueOnce(makeQuote({ regularMarketPrice: undefined, regularMarketPreviousClose: 4950 }))

    const result = await fetchStockPrice("ANTM")

    expect(result).not.toBeNull()
    expect(result!.price).toBe(4950)
    expect(result!.symbol).toBe("ANTM")
  })

  it("falls back to previous close when regularMarketPrice is null", async () => {
    mockQuote.mockResolvedValueOnce(makeQuote({ regularMarketPrice: null, regularMarketPreviousClose: 4900 }))

    const result = await fetchStockPrice("ANTM")

    expect(result).not.toBeNull()
    expect(result!.price).toBe(4900)
  })

  it("returns null when both live price and previous close are unavailable", async () => {
    // Yahoo returns a quote object but without any price data (truly invalid symbol)
    mockQuote.mockResolvedValueOnce(makeQuote({ regularMarketPrice: undefined, regularMarketPreviousClose: undefined }))

    const result = await fetchStockPrice("UNKNOWN")

    expect(result).toBeNull()
  })

  it("returns null when Yahoo Finance throws an error", async () => {
    mockQuote.mockRejectedValueOnce(new Error("Network error"))

    const result = await fetchStockPrice("ERROR")

    expect(result).toBeNull()
  })

  it("returns null when both prices are null", async () => {
    mockQuote.mockResolvedValueOnce(makeQuote({ regularMarketPrice: null, regularMarketPreviousClose: null }))

    const result = await fetchStockPrice("ANTM")

    expect(result).toBeNull()
  })

  it("defaults currency to IDR when missing", async () => {
    mockQuote.mockResolvedValueOnce(makeQuote({ currency: undefined }))

    const result = await fetchStockPrice("ANTM")

    expect(result).not.toBeNull()
    expect(result!.currency).toBe("IDR")
  })

  it("preserves the currency from the quote when present", async () => {
    mockQuote.mockResolvedValueOnce(makeQuote({ currency: "USD" }))

    const result = await fetchStockPrice("AAPL")

    expect(result).not.toBeNull()
    expect(result!.currency).toBe("USD")
  })
})

// ─── fetchStockPrices ────────────────────────────

describe("fetchStockPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns live prices for multiple clean symbols", async () => {
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250 }),
      makeQuote({ symbol: "BBRI.JK", regularMarketPrice: 4950 }),
      makeQuote({ symbol: "TLKM.JK", regularMarketPrice: 3850 }),
    ])

    const result = await fetchStockPrices(["BBCA", "BBRI", "TLKM"])

    expect(result.size).toBe(3)
    expect(result.get("BBCA")).toBe(10250)
    expect(result.get("BBRI")).toBe(4950)
    expect(result.get("TLKM")).toBe(3850)
    // Should query with .JK appended
    expect(mockQuote).toHaveBeenCalledWith(["BBCA.JK", "BBRI.JK", "TLKM.JK"])
  })

  it("handles a mix of symbols with and without .JK suffix", async () => {
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250 }),
      makeQuote({ symbol: "ANTM.JK", regularMarketPrice: 5050 }),
    ])

    const result = await fetchStockPrices(["BBCA", "ANTM.JK"])

    expect(result.size).toBe(2)
    expect(result.get("BBCA")).toBe(10250)
    expect(result.get("ANTM.JK")).toBe(5050)
    // BBCA → BBCA.JK (appended), ANTM.JK stays as-is
    expect(mockQuote).toHaveBeenCalledWith(["BBCA.JK", "ANTM.JK"])
  })

  it("deduplicates repeated symbols", async () => {
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250 }),
    ])

    const result = await fetchStockPrices(["BBCA", "BBCA", "BBCA"])

    expect(result.size).toBe(1)
    expect(result.get("BBCA")).toBe(10250)
    // Should only query once
    expect(mockQuote).toHaveBeenCalledTimes(1)
    expect(mockQuote).toHaveBeenCalledWith(["BBCA.JK"])
  })

  it("falls back to previous close for all symbols when market is closed", async () => {
    // Market closed for all symbols — no live price, but previous close available
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: undefined, regularMarketPreviousClose: 10200 }),
      makeQuote({ symbol: "BBRI.JK", regularMarketPrice: undefined, regularMarketPreviousClose: 4900 }),
    ])

    const result = await fetchStockPrices(["BBCA", "BBRI"])

    expect(result.size).toBe(2)
    expect(result.get("BBCA")).toBe(10200)
    expect(result.get("BBRI")).toBe(4900)
  })

  it("falls back to previous close for some symbols and uses live for others", async () => {
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250, regularMarketPreviousClose: 10200 }),
      makeQuote({ symbol: "BBRI.JK", regularMarketPrice: undefined, regularMarketPreviousClose: 4900 }),
    ])

    const result = await fetchStockPrices(["BBCA", "BBRI"])

    expect(result.size).toBe(2)
    // BBCA has live price
    expect(result.get("BBCA")).toBe(10250)
    // BBRI uses previous close fallback
    expect(result.get("BBRI")).toBe(4900)
  })

  it("returns empty map when both live and previous close are unavailable for all symbols", async () => {
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: undefined, regularMarketPreviousClose: undefined }),
      makeQuote({ symbol: "BBRI.JK", regularMarketPrice: null, regularMarketPreviousClose: null }),
    ])

    const result = await fetchStockPrices(["BBCA", "BBRI"])

    expect(result.size).toBe(0)
  })

  it("returns empty map when Yahoo Finance throws an error", async () => {
    mockQuote.mockRejectedValueOnce(new Error("API rate limited"))

    const result = await fetchStockPrices(["BBCA", "BBRI"])

    expect(result.size).toBe(0)
  })

  it("returns partial results when some symbols have no price data at all", async () => {
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250 }),
      makeQuote({ symbol: "DEAD.JK", regularMarketPrice: undefined, regularMarketPreviousClose: undefined }),
      makeQuote({ symbol: "BBRI.JK", regularMarketPrice: 4950 }),
    ])

    const result = await fetchStockPrices(["BBCA", "DEAD", "BBRI"])

    expect(result.size).toBe(2)
    expect(result.get("BBCA")).toBe(10250)
    expect(result.get("BBRI")).toBe(4950)
    expect(result.has("DEAD")).toBe(false)
  })

  it("handles a single-quote response (non-array) from Yahoo", async () => {
    // When querying a single symbol, Yahoo may return a single object instead of array
    mockQuote.mockResolvedValueOnce(
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250 }),
    )

    const result = await fetchStockPrices(["BBCA"])

    expect(result.size).toBe(1)
    expect(result.get("BBCA")).toBe(10250)
  })

  it("skips results whose symbol is not in the yahooToOriginal map", async () => {
    // Yahoo returns a quote for a symbol we didn't ask for (edge case)
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250 }),
      makeQuote({ symbol: "UNEXPECTED.JK", regularMarketPrice: 9999 }),
    ])

    const result = await fetchStockPrices(["BBCA"])

    expect(result.size).toBe(1)
    expect(result.get("BBCA")).toBe(10250)
    expect(result.has("UNEXPECTED")).toBe(false)
  })

  it("handles both .JK and non-.JK stored symbols properly", async () => {
    // Simulate a database where some symbols have .JK and some don't
    mockQuote.mockResolvedValueOnce([
      makeQuote({ symbol: "BBCA.JK", regularMarketPrice: 10250 }),
      makeQuote({ symbol: "ANTM.JK", regularMarketPrice: 5050 }),
      makeQuote({ symbol: "GOTO.JK", regularMarketPrice: 420 }),
    ])

    const result = await fetchStockPrices(["BBCA", "ANTM.JK", "GOTO.JK"])

    expect(result.size).toBe(3)
    // Symbol stored without .JK → mapped back correctly
    expect(result.get("BBCA")).toBe(10250)
    // Symbols stored with .JK → mapped back to original .JK format
    expect(result.get("ANTM.JK")).toBe(5050)
    expect(result.get("GOTO.JK")).toBe(420)
  })
})
