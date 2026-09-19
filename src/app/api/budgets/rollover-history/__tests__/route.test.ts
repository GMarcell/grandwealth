import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindBudgets = vi.hoisted(() => vi.fn())
const mockFindTransactions = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    budget: { findMany: mockFindBudgets },
    transaction: { findMany: mockFindTransactions },
  },
}))

// requireProAccess runs for real against the mocked prisma.user lookup.

// Import after mocks
const { GET } = await import("../route")

// ─── Helpers ─────────────────────────────────

/** Pro-entitled user, including the budget start day the route reads. */
function proUser(budgetStartDay: number, carryOverEnabled = true) {
  return {
    role: "USER",
    plan: "PRO",
    subscriptionStatus: "ACTIVE",
    currentPeriodEnd: null,
    suspended: false,
    budgetStartDay,
    carryOverEnabled,
  }
}

interface Options {
  budgetStartDay?: number
  carryOverEnabled?: boolean
  budgets?: Array<{
    categoryName: string
    amount: number
    month: string
    rolloverCap: number | null
  }>
  transactions?: Array<{
    type: string
    category: string
    amount: number
    date: Date
  }>
}

function setupMocks({
  budgetStartDay = 1,
  carryOverEnabled = true,
  budgets = [],
  transactions = [],
}: Options = {}) {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockFindUser.mockResolvedValue(proUser(budgetStartDay, carryOverEnabled))
  mockFindBudgets.mockResolvedValue(budgets)
  mockFindTransactions.mockResolvedValue(transactions)
}

const budget = (
  categoryName: string,
  amount: number,
  month: string,
): Options["budgets"] extends (infer T)[] | undefined ? T : never => ({
  categoryName,
  amount,
  month,
  rolloverCap: null,
})

const expense = (category: string, amount: number, date: Date) => ({
  type: "EXPENSE",
  category,
  amount,
  date,
})

// ─── Tests ───────────────────────────────────

describe("GET /api/budgets/rollover-history — auth", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockFindBudgets).not.toHaveBeenCalled()
  })
})

describe("GET /api/budgets/rollover-history — window & labels", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it("queries transactions over the correct (non-inverted) date window", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0)) // Sep 20

    setupMocks({
      budgetStartDay: 1,
      budgets: [budget("FOOD", 1_000_000, "2026-09")],
      transactions: [expense("FOOD", 400_000, new Date(2026, 8, 5, 12, 0, 0))],
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    // Oldest month start → newest month end. The start must be BEFORE the end.
    const { gte, lte } = mockFindTransactions.mock.calls[0][0].where.date
    expect(gte).toEqual(new Date(2025, 8, 1)) // Sep 1 2025
    expect(lte).toEqual(new Date(2026, 9, 0)) // Sep 30 2026
    expect(gte.getTime()).toBeLessThan(lte.getTime())

    // The current month's spend is actually counted (previously always 0).
    const entry = body.categories[0].months[0]
    expect(entry.spent).toBe(400_000)
    expect(entry.month).toBe("2026-09")
    expect(entry.monthLabel).toBe("Sep 2026") // corrected budget-month label
  })

  it("applies no carry-over when the global switch is off", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))

    setupMocks({
      carryOverEnabled: false,
      budgets: [
        budget("FOOD", 1_000_000, "2026-08"),
        budget("FOOD", 1_000_000, "2026-09"),
      ],
      // August under-spends by 800k.
      transactions: [expense("FOOD", 200_000, new Date(2026, 7, 10, 12, 0, 0))],
    })

    const res = await GET()
    const body = await res.json()

    const sep = body.categories[0].months.find(
      (m: { month: string }) => m.month === "2026-09",
    )
    // The 800k unused from August must NOT roll into September.
    expect(sep.rolloverReceived).toBe(0)
    expect(sep.carryOverEnabled).toBe(false)
  })

  it("labels and windows a 28th-start cycle by the ending month", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0)) // Sep 20 → current month is "2026-08"

    setupMocks({
      budgetStartDay: 28,
      budgets: [budget("FOOD", 500_000, "2026-08")],
      transactions: [expense("FOOD", 100_000, new Date(2026, 8, 10, 12, 0, 0))],
    })

    const res = await GET()
    const body = await res.json()

    // Newest window edge is the end of 28 Aug – 27 Sep.
    const { lte } = mockFindTransactions.mock.calls[0][0].where.date
    expect(lte).toEqual(new Date(2026, 8, 27))

    const entry = body.categories[0].months[0]
    expect(entry.month).toBe("2026-08")
    expect(entry.monthLabel).toBe("Sep 2026")
    expect(entry.spent).toBe(100_000)

    // The column header list ends at the current budget month, labelled Sep.
    const last = body.months[body.months.length - 1]
    expect(last.key).toBe("2026-08")
    expect(last.label).toBe("Sep 2026")
    // No not-yet-started future budget month is offered.
    expect(body.months.some((m: { key: string }) => m.key === "2026-09")).toBe(false)
  })
})
