import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindStocks = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())
const mockFetchStockDividendInfos = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    stock: { findMany: mockFindStocks },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Only the Yahoo-facing call is mocked. The calendar maths stays real so this
// suite covers how the route feeds it (the maths itself is covered in
// src/lib/__tests__/dividends.test.ts).
vi.mock("@/lib/dividends", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dividends")>()
  return { ...actual, fetchStockDividendInfos: mockFetchStockDividendInfos }
})

const { GET } = await import("../route")

const PRO_USER = {
  role: "USER",
  plan: "PRO",
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  suspended: false,
}

interface FakeStock {
  id: string
  symbol: string
  name: string
  quantity: number
  buyPrice: number
  date: Date
}

function stock(overrides: Partial<FakeStock> = {}): FakeStock {
  return {
    id: "stock-1",
    symbol: "ANTM",
    name: "Aneka Tambang",
    quantity: 10,
    buyPrice: 2_000_000,
    date: new Date("2026-02-01"),
    ...overrides,
  }
}

/** Dividend info as returned by the (mocked) Yahoo layer. */
function dividendInfo(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "ANTM",
    currency: "IDR",
    lastDividendPerShare: 210,
    lastDividendDate: "2026-06-22",
    trailingDividendPerShare: 210,
    dividendYield: 0.06,
    payoutRatio: 0.5,
    frequency: "ANNUAL",
    medianGapDays: 364,
    trailingPaymentCount: 2,
    estimatedNextExDate: "2027-06-21",
    history: [{ date: "2026-06-22", amountPerShare: 210 }],
    ...overrides,
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const isoInDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10)
const monthKeyInDays = (days: number) =>
  new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 7)

const get = () => GET(new Request("http://localhost/api/dividends/upcoming"))

describe("GET /api/dividends/upcoming — auth, entitlement & limits", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUser.mockResolvedValue(PRO_USER)
    mockRateLimit.mockResolvedValue({ allowed: true })
    mockGetRateLimitKey.mockReturnValue("key")
    mockFindStocks.mockResolvedValue([])
    mockFetchStockDividendInfos.mockResolvedValue(new Map())
  })

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await get()

    expect(res.status).toBe(401)
    expect(mockFindStocks).not.toHaveBeenCalled()
  })

  it("returns 403 for a Free user (stocks are Pro-only)", async () => {
    mockFindUser.mockResolvedValue({
      role: "USER",
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      suspended: false,
    })

    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Pro subscription required")
    expect(mockFetchStockDividendInfos).not.toHaveBeenCalled()
  })

  it("returns 429 when the user is rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false })

    const res = await get()

    expect(res.status).toBe(429)
    expect(mockFindStocks).not.toHaveBeenCalled()
  })

  it("returns 500 when the database read fails", async () => {
    mockFindStocks.mockRejectedValue(new Error("db down"))

    const res = await get()

    expect(res.status).toBe(500)
  })

  it("returns an empty projection set when the user holds nothing", async () => {
    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.totals).toEqual({
      estimatedNextPayout: 0,
      estimatedAnnualIncome: 0,
      holdingsWithDividends: 0,
      holdingsWithoutData: 0,
    })
    // Empty input short-circuits inside the dividend layer (covered by its own
    // tests), so Yahoo is never contacted for a portfolio with no stocks.
    expect(mockFetchStockDividendInfos).toHaveBeenCalledWith([])
  })
})

describe("GET /api/dividends/upcoming — projections", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUser.mockResolvedValue(PRO_USER)
    mockRateLimit.mockResolvedValue({ allowed: true })
    mockGetRateLimitKey.mockReturnValue("key")
  })

  it("aggregates lots across rows and converts to shares (1 lot = 100)", async () => {
    mockFindStocks.mockResolvedValue([
      stock({ id: "s1", quantity: 5, buyPrice: 2_000_000, date: new Date("2026-02-01") }),
      stock({ id: "s2", quantity: 5, buyPrice: 1_800_000, date: new Date("2026-01-01") }),
    ])
    mockFetchStockDividendInfos.mockResolvedValue(new Map([["ANTM", dividendInfo()]]))

    const res = await get()
    const body = await res.json()

    expect(mockFetchStockDividendInfos).toHaveBeenCalledWith(["ANTM"])
    expect(body.data).toHaveLength(1)

    const [projection] = body.data
    expect(projection.symbol).toBe("ANTM")
    expect(projection.lots).toBe(10)
    expect(projection.shares).toBe(1000)
    // Newest row wins as the record target.
    expect(projection.stockId).toBe("s1")
  })

  it("estimates the next payout from the last payment and the year from trailing", async () => {
    mockFindStocks.mockResolvedValue([stock({ quantity: 10, buyPrice: 2_000_000 })])
    mockFetchStockDividendInfos.mockResolvedValue(
      new Map([
        [
          "ANTM",
          dividendInfo({
            lastDividendPerShare: 210,
            trailingDividendPerShare: 230,
          }),
        ],
      ])
    )

    const res = await get()
    const body = await res.json()
    const [projection] = body.data

    // 1,000 shares
    expect(projection.estimatedNextPayout).toBe(210_000)
    expect(projection.estimatedAnnualIncome).toBe(230_000)
    // 230,000 / (10 lots x 2,000,000)
    expect(projection.yieldOnCost).toBeCloseTo(0.0115, 4)
    expect(projection.estimatedNextExDate).toBe("2027-06-21")
    expect(body.totals.estimatedNextPayout).toBe(210_000)
    expect(body.totals.estimatedAnnualIncome).toBe(230_000)
    expect(body.totals.holdingsWithDividends).toBe(1)
  })

  it("rounds fractional per-share amounts to a whole rupiah payout", async () => {
    mockFindStocks.mockResolvedValue([stock({ quantity: 1, buyPrice: 1_000_000 })])
    mockFetchStockDividendInfos.mockResolvedValue(
      new Map([["ANTM", dividendInfo({ lastDividendPerShare: 223.16588 })]])
    )

    const res = await get()
    const body = await res.json()

    // 100 shares x 223.16588 = 22,316.588
    expect(body.data[0].estimatedNextPayout).toBe(22317)
  })

  it("skips holdings with no dividend data and counts them", async () => {
    mockFindStocks.mockResolvedValue([
      stock({ id: "s1", symbol: "ANTM", name: "Aneka Tambang" }),
      stock({ id: "s2", symbol: "ABDA", name: "Asuransi Bina Dana Arta" }),
    ])
    mockFetchStockDividendInfos.mockResolvedValue(new Map([["ANTM", dividendInfo()]]))

    const res = await get()
    const body = await res.json()

    expect(body.data.map((d: { symbol: string }) => d.symbol)).toEqual(["ANTM"])
    expect(body.totals.holdingsWithoutData).toBe(1)
  })

  it("normalises stored symbols before querying Yahoo", async () => {
    mockFindStocks.mockResolvedValue([stock({ symbol: " antm " })])
    mockFetchStockDividendInfos.mockResolvedValue(new Map([["ANTM", dividendInfo()]]))

    const res = await get()
    const body = await res.json()

    expect(mockFetchStockDividendInfos).toHaveBeenCalledWith(["ANTM"])
    expect(body.data[0].symbol).toBe("ANTM")
  })

  it("orders soonest ex-dividend first and pushes unknown dates last", async () => {
    mockFindStocks.mockResolvedValue([
      stock({ id: "s1", symbol: "ANTM", name: "Aneka Tambang" }),
      stock({ id: "s2", symbol: "BBCA", name: "Bank Central Asia" }),
      stock({ id: "s3", symbol: "TLKM", name: "Telkom Indonesia" }),
    ])
    mockFetchStockDividendInfos.mockResolvedValue(
      new Map([
        ["ANTM", dividendInfo({ symbol: "ANTM", estimatedNextExDate: "2027-06-21" })],
        ["BBCA", dividendInfo({ symbol: "BBCA", estimatedNextExDate: "2026-11-18" })],
        ["TLKM", dividendInfo({ symbol: "TLKM", estimatedNextExDate: null })],
      ])
    )

    const res = await get()
    const body = await res.json()

    expect(body.data.map((d: { symbol: string }) => d.symbol)).toEqual([
      "BBCA",
      "ANTM",
      "TLKM",
    ])
  })

  it("returns a 12-month calendar starting with the current month", async () => {
    mockFindStocks.mockResolvedValue([stock()])
    mockFetchStockDividendInfos.mockResolvedValue(new Map([["ANTM", dividendInfo()]]))

    const res = await get()
    const body = await res.json()

    expect(body.calendar.months).toHaveLength(12)
    expect(body.calendar.months[0].month).toBe(new Date().toISOString().slice(0, 7))
    expect(body.calendar.total).toBe(
      body.calendar.months.reduce((sum: number, m: { total: number }) => sum + m.total, 0)
    )
  })

  it("sizes each calendar payment from the trailing average, not the last payment", async () => {
    mockFindStocks.mockResolvedValue([stock({ quantity: 10, buyPrice: 2_000_000 })])
    mockFetchStockDividendInfos.mockResolvedValue(
      new Map([
        [
          "ANTM",
          dividendInfo({
            // 200/share across 2 payments => 100/share per payment, vs the
            // 25/share last interim which would badly understate the year.
            lastDividendPerShare: 25,
            trailingDividendPerShare: 200,
            trailingPaymentCount: 2,
            medianGapDays: 90,
            estimatedNextExDate: isoInDays(10),
          }),
        ],
      ])
    )

    const res = await get()
    const body = await res.json()

    // ex-date + ~3 weeks lands roughly a month out; 1,000 shares x 100/share.
    const payDate = isoInDays(31)
    expect(body.calendar.paymentsCount).toBeGreaterThanOrEqual(4)

    const bucket = body.calendar.months.find(
      (m: { month: string }) => m.month === monthKeyInDays(31)
    )
    const payment = bucket.payments.find(
      (p: { estimatedPayDate: string }) => p.estimatedPayDate === payDate
    )
    expect(payment).toBeDefined()
    expect(payment.amount).toBe(100_000)
    expect(payment.estimatedExDate).toBe(isoInDays(10))
  })

  it("leaves the calendar empty when no holding can be projected", async () => {
    mockFindStocks.mockResolvedValue([stock()])
    mockFetchStockDividendInfos.mockResolvedValue(
      new Map([
        [
          "ANTM",
          dividendInfo({ estimatedNextExDate: null, medianGapDays: null }),
        ],
      ])
    )

    const res = await get()
    const body = await res.json()

    expect(body.calendar.months).toHaveLength(12)
    expect(body.calendar.paymentsCount).toBe(0)
    expect(body.calendar.total).toBe(0)
    expect(body.data).toHaveLength(1)
  })

  it("handles a stock whose per-share amounts are unknown gracefully", async () => {
    mockFindStocks.mockResolvedValue([stock()])
    mockFetchStockDividendInfos.mockResolvedValue(
      new Map([
        [
          "ANTM",
          dividendInfo({
            lastDividendPerShare: null,
            trailingDividendPerShare: null,
            estimatedNextExDate: null,
          }),
        ],
      ])
    )

    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].estimatedNextPayout).toBeNull()
    expect(body.data[0].estimatedAnnualIncome).toBeNull()
    expect(body.data[0].yieldOnCost).toBeNull()
    expect(body.totals.estimatedNextPayout).toBe(0)
  })
})
