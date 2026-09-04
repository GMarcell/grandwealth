import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindTransactions = vi.hoisted(() => vi.fn())
const mockGroupByTransactions = vi.hoisted(() => vi.fn())
const mockFindGold = vi.hoisted(() => vi.fn())
const mockFindStocks = vi.hoisted(() => vi.fn())
const mockFindBudgets = vi.hoisted(() => vi.fn())
const mockFindAnalysis = vi.hoisted(() => vi.fn())
const mockFindCategories = vi.hoisted(() => vi.fn())
const mockFindSavings = vi.hoisted(() => vi.fn())
const mockFindLoans = vi.hoisted(() => vi.fn())
const mockFetchGoldPrice = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    transaction: {
      findMany: mockFindTransactions,
      groupBy: mockGroupByTransactions,
    },
    goldDeposit: { findMany: mockFindGold },
    stock: { findMany: mockFindStocks },
    budget: { findMany: mockFindBudgets },
    monthlyAnalysis: { findFirst: mockFindAnalysis },
    category: { findMany: mockFindCategories },
    bankSaving: { findMany: mockFindSavings },
    loan: { findMany: mockFindLoans },
  },
}))

vi.mock("@/lib/prices", () => ({ fetchGoldPriceIdr: mockFetchGoldPrice }))

// Import after mocks
const { GET } = await import("../route")

// ─── Helpers ─────────────────────────────────

const now = new Date()
const currentMonth = now.getMonth()
const currentYear = now.getFullYear()

/** Local-time date at midday so it never flirts with a day boundary. */
function monthDate(monthOffset: number, day: number): Date {
  return new Date(currentYear, currentMonth + monthOffset, day, 12, 0, 0)
}

const PREV_MONTH = monthDate(-1, 15)
const CURRENT_MONTH = monthDate(0, 15)

interface GoldFixture {
  type: "BUY" | "SELL"
  weightGram: number
  pricePerGram?: number
  totalAmount: number
  date: Date
}

interface DashboardMockOptions {
  /** Budget start day returned by /api/user lookup. Default 1 (calendar). */
  budgetStartDay?: number
  /** Transactions returned by the 13-month window query. */
  windowTransactions?: Array<{
    id: string
    type: "INCOME" | "EXPENSE"
    category: string
    amount: number
    description: string
    date: Date
  }>
  /** Result of the all-time groupBy (income/expense sums). */
  allTimeCash?: Array<{ type: "INCOME" | "EXPENSE"; _sum: { amount: number } }>
  goldDeposits?: GoldFixture[]
  /** Live gold price to return (or "error" to force the fallback path). */
  goldPricePerGram?: number | "error"
  /** Current-month budgets and previous-month budgets. */
  budgets?: Array<Record<string, unknown>>
  prevBudgets?: Array<Record<string, unknown>>
}

function setupMocks(options: DashboardMockOptions = {}) {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockFindUser.mockResolvedValue({ budgetStartDay: options.budgetStartDay ?? 1 })
  mockFindTransactions.mockResolvedValue(options.windowTransactions ?? [])
  mockGroupByTransactions.mockResolvedValue(options.allTimeCash ?? [])
  mockFindGold.mockResolvedValue(options.goldDeposits ?? [])
  mockFindStocks.mockResolvedValue([])
  mockFindBudgets
    .mockResolvedValueOnce(options.budgets ?? [])
    .mockResolvedValueOnce(options.prevBudgets ?? [])
  mockFindAnalysis.mockResolvedValue(null)
  mockFindCategories.mockResolvedValue([])
  mockFindSavings.mockResolvedValue([])
  mockFindLoans.mockResolvedValue([])

  const goldPrice = options.goldPricePerGram
  if (goldPrice === "error") {
    mockFetchGoldPrice.mockRejectedValue(new Error("Yahoo down"))
  } else {
    mockFetchGoldPrice.mockResolvedValue({
      pricePerGramIdr: goldPrice ?? 1_500_000,
    })
  }
}

const tx = (
  id: string,
  type: "INCOME" | "EXPENSE",
  category: string,
  amount: number,
  date: Date,
) => ({ id, type, category, amount, description: `${id} desc`, date })

const budget = (categoryName: string, amount: number, month: string) => ({
  id: `budget-${categoryName}`,
  categoryName,
  amount,
  month,
  rolloverEnabled: false,
  rolloverCap: null,
  userId: "user-1",
})

const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`

// ─── Tests ───────────────────────────────────

describe("GET /api/dashboard — auth", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
    expect(mockFindTransactions).not.toHaveBeenCalled()
  })
})

describe("GET /api/dashboard — aggregation correctness", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  })

  it("aggregates over more than 50 transactions in the window (no take cap)", async () => {
    // 60 FOOD expenses this month (would have been silently truncated by the
    // old `take: 50`) plus 1 older expense inside the 13-month window.
    const foodExpenses = Array.from({ length: 60 }, (_, i) =>
      tx(`exp-${i}`, "EXPENSE", "FOOD", 1000, CURRENT_MONTH)
    )
    const olderExpense = tx("exp-old", "EXPENSE", "TRANSPORTATION", 5000, PREV_MONTH)

    setupMocks({
      windowTransactions: [...foodExpenses, olderExpense],
      budgets: [budget("FOOD", 50_000, currentMonthKey)],
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    // Full-window totals include all 61 transactions.
    expect(body.totalExpenses).toBe(65_000)
    expect(body.netCashflow).toBe(-65_000)

    // Budget spent uses every FOOD expense in the current budget month.
    expect(body.budgetSummary.totalSpent).toBe(60_000)
    expect(body.budgetSummary.totalBudgeted).toBe(50_000)
    expect(body.budgetSummary.overBudget).toBe(1)
    expect(body.budgetSummary.overBudgetEntries).toHaveLength(1)
    expect(body.budgetSummary.overBudgetEntries[0]).toMatchObject({
      categoryName: "FOOD",
      overspent: 10_000,
      percentUsed: 120,
    })

    // The monthly chart has both the previous and current month buckets and
    // the buckets account for every transaction in the window.
    expect(body.monthlyData).toHaveLength(2)
    const chartExpenses = body.monthlyData.reduce(
      (sum: number, m: { expenses: number }) => sum + m.expenses,
      0
    )
    expect(chartExpenses).toBe(65_000)

    // Recent transactions come from the (uncapped) list.
    expect(body.recentTransactions).toHaveLength(5)
  })

  it("uses all-time net cash flow (groupBy) for total wealth, not the 13-month window", async () => {
    setupMocks({
      // Window only shows the last 13 months; the groupBy covers all history.
      windowTransactions: [
        tx("recent-income", "INCOME", "SALARY", 5_000_000, CURRENT_MONTH),
      ],
      allTimeCash: [
        { type: "INCOME", _sum: { amount: 120_000_000 } },
        { type: "EXPENSE", _sum: { amount: 30_000_000 } },
      ],
    })

    const res = await GET()
    const body = await res.json()

    expect(body.netCashflow).toBe(5_000_000) // 13-month window figure
    expect(body.allTimeNetCashflow).toBe(90_000_000) // full history
    // No gold/stocks/savings/debt in this fixture → wealth = all-time cash.
    expect(body.totalWealth).toBe(90_000_000)
  })

  it("marks gold at the live market price when a price is available", async () => {
    setupMocks({
      goldDeposits: [
        {
          type: "BUY",
          weightGram: 10,
          totalAmount: 10_000_000, // bought at 1jt/g
          date: CURRENT_MONTH,
        },
      ],
      goldPricePerGram: 1_500_000,
      allTimeCash: [],
    })

    const res = await GET()
    const body = await res.json()

    expect(mockFetchGoldPrice).toHaveBeenCalledTimes(1)
    expect(body.totalGoldWeight).toBe(10)
    expect(body.totalGoldValue).toBe(15_000_000) // 10g × 1.5jt — not cost basis
    expect(body.totalWealth).toBe(15_000_000)
  })

  it("falls back to the gold cost basis when the live price fetch fails", async () => {
    setupMocks({
      goldDeposits: [
        {
          type: "BUY",
          weightGram: 10,
          totalAmount: 10_000_000,
          date: CURRENT_MONTH,
        },
      ],
      goldPricePerGram: "error",
      allTimeCash: [],
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.totalGoldWeight).toBe(10)
    expect(body.totalGoldValue).toBe(10_000_000) // cost basis fallback
  })

  it("does not fetch the live price when the user holds no gold", async () => {
    setupMocks({ goldDeposits: [] })

    const res = await GET()
    const body = await res.json()

    expect(mockFetchGoldPrice).not.toHaveBeenCalled()
    expect(body.totalGoldValue).toBe(0)
    expect(body.totalGoldWeight).toBe(0)
  })
})

describe("GET /api/dashboard — budget month rollover with non-1st start day", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rolls over from the true previous budget month when startDay=28 and today is before the 28th", async () => {
    // Regression: the old inline `new Date(year, month - 1, startDay)` math
    // collapsed the previous month to the CURRENT budget month on any day
    // before the 28th, so prevBudgets and prev-spend were read from the
    // current period (inflating rollover and effective budget).
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 4, 12, 0, 0)) // Sep 4 — before the 28th

    setupMocks({
      budgetStartDay: 28,
      windowTransactions: [
        // Previous budget month (Jul 28 – Aug 27): Jul 29
        tx("prev-spend", "EXPENSE", "FOOD", 40_000, new Date(2026, 6, 29, 12, 0, 0)),
        // Current budget month (Aug 28 – Sep 27): Sep 3
        tx("cur-spend", "EXPENSE", "FOOD", 30_000, new Date(2026, 8, 3, 12, 0, 0)),
      ],
      budgets: [{ ...budget("FOOD", 50_000, "2026-08"), rolloverEnabled: true }],
      prevBudgets: [budget("FOOD", 50_000, "2026-07")],
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    // The prev-budget query must target the true previous budget month.
    const budgetCalls = mockFindBudgets.mock.calls
    expect(budgetCalls).toHaveLength(2)
    expect(budgetCalls[1][0]).toMatchObject({
      where: { userId: "user-1", month: "2026-07" },
    })

    // Rollover = 50k prev budget − 40k prev spend = 10k; effective = 60k.
    // (The old code read prev spend as the current period's 30k → 20k rollover.)
    expect(body.budgetSummary.totalRollover).toBe(10_000)
    expect(body.budgetSummary.totalEffective).toBe(60_000)
    expect(body.budgetSummary.totalSpent).toBe(30_000)
    expect(body.budgetSummary.remaining).toBe(30_000)
  })
})
