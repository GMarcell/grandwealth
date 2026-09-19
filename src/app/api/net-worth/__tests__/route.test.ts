import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindTransactions = vi.hoisted(() => vi.fn())
const mockFindGold = vi.hoisted(() => vi.fn())
const mockFindStocks = vi.hoisted(() => vi.fn())
const mockFindSavings = vi.hoisted(() => vi.fn())
const mockFindLoans = vi.hoisted(() => vi.fn())
const mockFetchGoldPrice = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    transaction: { findMany: mockFindTransactions },
    goldDeposit: { findMany: mockFindGold },
    stock: { findMany: mockFindStocks },
    bankSaving: { findMany: mockFindSavings },
    loan: { findMany: mockFindLoans },
  },
}))

vi.mock("@/lib/prices", () => ({ fetchGoldPriceIdr: mockFetchGoldPrice }))

// computeNetWorthHistory and computeGoldPortfolio are left unmocked — they are
// pure and their integration with the route is exactly what we are testing.

// Import after mocks
const { GET } = await import("../route")

// ─── Helpers ─────────────────────────────────

const now = new Date()

/** Local-time date at midday so it never flirts with a day boundary. */
function daysAgo(n: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  d.setHours(12, 0, 0, 0)
  return d
}

interface NetWorthMockOptions {
  goldDeposits?: Array<{
    type: "BUY" | "SELL"
    weightGram: number
    totalAmount: number
    date: Date
  }>
  transactions?: Array<{ type: "INCOME" | "EXPENSE"; amount: number; date: Date }>
  /** Live gold price to return, or "error" to force the cost-basis fallback. */
  goldPricePerGram?: number | "error"
  /** Budget start day returned by the user lookup. Default 1 (calendar). */
  budgetStartDay?: number
}

function setupMocks(options: NetWorthMockOptions = {}) {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockFindUser.mockResolvedValue({ budgetStartDay: options.budgetStartDay ?? 1 })
  mockFindTransactions.mockResolvedValue(options.transactions ?? [])
  mockFindGold.mockResolvedValue(options.goldDeposits ?? [])
  mockFindStocks.mockResolvedValue([])
  mockFindSavings.mockResolvedValue([])
  mockFindLoans.mockResolvedValue([])

  const goldPrice = options.goldPricePerGram
  if (goldPrice === "error") {
    mockFetchGoldPrice.mockRejectedValue(new Error("Yahoo down"))
  } else {
    mockFetchGoldPrice.mockResolvedValue({ pricePerGramIdr: goldPrice ?? 1_500_000 })
  }
}

const BUY = (weightGram: number, totalAmount: number, date: Date) => ({
  type: "BUY" as const,
  weightGram,
  totalAmount,
  date,
})

const SELL = (weightGram: number, totalAmount: number, date: Date) => ({
  type: "SELL" as const,
  weightGram,
  totalAmount,
  date,
})

function get(url: string) {
  return GET(new Request(`http://localhost${url}`))
}

// ─── Tests ───────────────────────────────────

describe("GET /api/net-worth — auth", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await get("/api/net-worth")
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
    expect(mockFindTransactions).not.toHaveBeenCalled()
  })
})

describe("GET /api/net-worth — months parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it("defaults to 12 months when the parameter is absent", async () => {
    const body = await (await get("/api/net-worth")).json()
    expect(body.months).toBe(12)
    expect(body.history).toHaveLength(12)
  })

  it("clamps values below the minimum of 3", async () => {
    const body = await (await get("/api/net-worth?months=2")).json()
    expect(body.months).toBe(3)
    expect(body.history).toHaveLength(3)
  })

  it("clamps values above the maximum of 36", async () => {
    const body = await (await get("/api/net-worth?months=100")).json()
    expect(body.months).toBe(36)
    expect(body.history).toHaveLength(36)
  })

  it("falls back to 12 months for non-numeric input", async () => {
    const body = await (await get("/api/net-worth?months=abc")).json()
    expect(body.months).toBe(12)
  })

  it("honors an in-range value", async () => {
    const body = await (await get("/api/net-worth?months=6")).json()
    expect(body.months).toBe(6)
    expect(body.history).toHaveLength(6)
  })
})

describe("GET /api/net-worth — gold valuation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  })

  it("marks held gold at the live market price when the fetch succeeds", async () => {
    setupMocks({
      goldDeposits: [BUY(10, 10_000_000, daysAgo(1))], // bought at 1jt/g
      goldPricePerGram: 1_500_000,
    })

    const body = await (await get("/api/net-worth")).json()

    expect(mockFetchGoldPrice).toHaveBeenCalledTimes(1)
    expect(body.goldPricePerGram).toBe(1_500_000)
    expect(body.latest.gold).toBe(15_000_000) // 10g × 1.5jt
  })

  it("falls back to the cost basis of remaining holdings when the fetch fails", async () => {
    setupMocks({
      goldDeposits: [
        BUY(10, 10_000_000, daysAgo(3)), // 10g @ 1jt/g
        SELL(4, 5_000_000, daysAgo(2)), // sold 4g at 1.25jt/g (profit)
      ],
      goldPricePerGram: "error",
    })

    const body = await (await get("/api/net-worth")).json()

    expect(mockFetchGoldPrice).toHaveBeenCalledTimes(1)
    expect(body.goldPricePerGram).toBeNull()
    // 6g remaining × 1jt/g average cost = 6jt — NOT the 10jt gross bought and
    // NOT the 5jt proceeds-based figure.
    expect(body.latest.gold).toBe(6_000_000)
  })

  it("marks remaining holdings at live price after a sell", async () => {
    setupMocks({
      goldDeposits: [
        BUY(10, 10_000_000, daysAgo(3)),
        SELL(4, 5_000_000, daysAgo(2)),
      ],
      goldPricePerGram: 1_500_000,
    })

    const body = await (await get("/api/net-worth")).json()

    expect(body.latest.gold).toBe(9_000_000) // 6g × 1.5jt
  })

  it("does not fetch the live price when nothing is held (fully sold)", async () => {
    setupMocks({
      goldDeposits: [
        BUY(5, 5_000_000, daysAgo(3)),
        SELL(5, 5_000_000, daysAgo(2)),
      ],
      goldPricePerGram: 1_500_000,
    })

    const body = await (await get("/api/net-worth")).json()

    expect(mockFetchGoldPrice).not.toHaveBeenCalled()
    expect(body.goldPricePerGram).toBeNull()
    expect(body.latest.gold).toBe(0)
  })
})

describe("GET /api/net-worth — budget month boundaries", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it("buckets the series by the user's budget month", async () => {
    // Sep 20 is before the 28th, so the current budget month is Aug 28 – Sep 27.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))

    setupMocks({
      budgetStartDay: 28,
      // Salary paid on Aug 29 belongs to the "Sep 2026" budget month.
      transactions: [
        { type: "INCOME", amount: 5_000_000, date: new Date(2026, 7, 29, 12, 0, 0) },
      ],
    })

    // The route clamps `months` to a minimum of 3.
    const body = await (await get("/api/net-worth?months=3")).json()
    const [, mid, latest] = body.history

    expect(latest.label).toBe("Sep 2026")
    expect(latest.month).toBe("2026-08")
    expect(latest.cash).toBe(5_000_000)

    // The "Aug 2026" budget month runs Jul 28 – Aug 27, so the Aug 29 salary
    // is NOT counted there (it belongs to September).
    expect(mid.label).toBe("Aug 2026")
    expect(mid.month).toBe("2026-07")
    expect(mid.cash).toBe(0)
  })

  it("keeps calendar months when the start day is 1", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))

    setupMocks({
      budgetStartDay: 1,
      transactions: [
        { type: "INCOME", amount: 5_000_000, date: new Date(2026, 7, 29, 12, 0, 0) },
      ],
    })

    const body = await (await get("/api/net-worth?months=3")).json()

    // Calendar months: the Aug 29 salary sits in "Aug 2026" (cutoff 31 Aug).
    const august = body.history.find((h: { label: string }) => h.label === "Aug 2026")
    expect(august.month).toBe("2026-08")
    expect(august.cash).toBe(5_000_000)
  })
})
