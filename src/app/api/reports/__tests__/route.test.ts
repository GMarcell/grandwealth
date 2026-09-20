import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  generateBudgetMonths,
  getBudgetMonthKey,
  getBudgetMonthRange,
  getPreviousBudgetMonthKey,
} from "@/lib/budget-months"

// ─── Hoisted mocks ───────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindTransactions = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    transaction: { findMany: mockFindTransactions },
  },
}))

const { GET } = await import("../route")

const DAY_MS = 24 * 60 * 60 * 1000

/** Entitled user; `budgetStartDay` is what these tests vary. */
function proUser(budgetStartDay = 1) {
  return {
    role: "USER",
    plan: "PRO",
    subscriptionStatus: "ACTIVE",
    currentPeriodEnd: null,
    suspended: false,
    budgetStartDay,
  }
}

const get = (query = "") => GET(new Request(`http://localhost/api/reports${query}`))

/** The `date` filter the route passed to Prisma. */
function dateFilter() {
  const args = mockFindTransactions.mock.calls[0][0]
  return args.where.date as { gte: Date; lte: Date }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockFindUser.mockResolvedValue(proUser())
  mockFindTransactions.mockResolvedValue([])
})

// ─── Auth & entitlement ──────────────────────────

describe("GET /api/reports — auth & entitlement", () => {
  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await get()

    expect(res.status).toBe(401)
    expect(mockFindTransactions).not.toHaveBeenCalled()
  })

  it("returns 403 for a Free user", async () => {
    mockFindUser.mockResolvedValue({
      role: "USER",
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      suspended: false,
      budgetStartDay: 1,
    })

    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Pro subscription required")
  })

  it("returns 500 when the transaction query fails", async () => {
    mockFindTransactions.mockRejectedValue(new Error("db down"))

    const res = await get()

    expect(res.status).toBe(500)
  })

  it("treats a missing budgetStartDay as the 1st", async () => {
    mockFindUser.mockResolvedValue({ ...proUser(), budgetStartDay: undefined })

    const res = await get()

    expect(res.status).toBe(200)
    expect(dateFilter().gte.getDate()).toBe(1)
  })
})

// ─── The fetch window follows the budget cycle ───

describe("GET /api/reports — budget month window", () => {
  it("uses calendar months when the start day is 1", async () => {
    mockFindUser.mockResolvedValue(proUser(1))

    await get("?months=12")

    const { gte, lte } = dateFilter()
    // First of the month, twelve budget months back.
    expect(gte.getDate()).toBe(1)
    // End of the current calendar month.
    const expectedEnd = new Date(lte.getFullYear(), lte.getMonth() + 1, 0)
    expect(lte.getTime()).toBe(expectedEnd.getTime())
  })

  it("aligns the window to a mid-month start day", async () => {
    mockFindUser.mockResolvedValue(proUser(15))

    await get("?months=12")

    const { gte, lte } = dateFilter()
    // Period starts on the 15th and ends the day before the next cycle starts.
    expect(gte.getDate()).toBe(15)
    expect(lte.getDate()).toBe(14)
  })

  it("spans the requested number of months regardless of start day", async () => {
    mockFindUser.mockResolvedValue(proUser(15))

    await get("?months=12")

    const { gte, lte } = dateFilter()
    const months = (lte.getTime() - gte.getTime()) / (DAY_MS * 30)
    expect(months).toBeGreaterThan(11.5)
    expect(months).toBeLessThan(12.5)
  })

  it("honours the months parameter", async () => {
    mockFindUser.mockResolvedValue(proUser(28))

    await get("?months=3")

    const { gte, lte } = dateFilter()
    // Three budget months, so ~3 x 30 days.
    const months = (lte.getTime() - gte.getTime()) / (DAY_MS * 30)
    expect(months).toBeGreaterThan(2.5)
    expect(months).toBeLessThan(3.5)
    expect(gte).toEqual(getBudgetMonthRange(generateBudgetMonths(3, 28)[2], 28).start)
  })
})

// ─── Bucketing follows the budget cycle ──────────

describe("GET /api/reports — monthly breakdown after the fix", () => {
  const START_DAY = 15

  /**
   * Two expenses straddling the budget month boundary:
   *   - "before" sits on the last day of the previous cycle
   *   - "inside" sits on the second day of the current cycle
   * With a 15th start day these are separate budget months, but they fall in the
   * SAME calendar month whenever the boundary is mid-month — which is exactly
   * the bug: calendar bucketing merged them.
   */
  function straddlingTransactions() {
    const currentKey = getBudgetMonthKey(new Date(), START_DAY)
    const { start } = getBudgetMonthRange(currentKey, START_DAY)

    return {
      currentKey,
      previousKey: getPreviousBudgetMonthKey(currentKey, START_DAY),
      before: new Date(start.getTime() - DAY_MS),
      inside: new Date(start.getTime() + DAY_MS),
    }
  }

  beforeEach(() => {
    mockFindUser.mockResolvedValue(proUser(START_DAY))
  })

  it("puts each transaction in its budget month, not its calendar month", async () => {
    const { currentKey, previousKey, before, inside } = straddlingTransactions()
    mockFindTransactions.mockResolvedValue([
      { date: before, amount: 100_000, type: "EXPENSE", category: "Food" },
      { date: inside, amount: 250_000, type: "EXPENSE", category: "Food" },
    ])

    const res = await get()
    const body = await res.json()

    const previous = body.monthlyBreakdown.find(
      (m: { month: string }) => m.month === previousKey
    )
    const current = body.monthlyBreakdown.find((m: { month: string }) => m.month === currentKey)

    expect(previous).toBeDefined()
    expect(current).toBeDefined()
    expect(previous.expenses).toBe(100_000)
    expect(previous.transactionCount).toBe(1)
    expect(current.expenses).toBe(250_000)
    expect(current.transactionCount).toBe(1)

    // The straddling pair must not be collapsed into one calendar-month row.
    const sameBucket = body.monthlyBreakdown.filter(
      (m: { expenses: number }) => m.expenses === 350_000
    )
    expect(sameBucket).toHaveLength(0)
  })

  it("labels rows with the budget month, not the calendar month", async () => {
    const { currentKey, before } = straddlingTransactions()
    mockFindTransactions.mockResolvedValue([
      { date: before, amount: 100_000, type: "EXPENSE", category: "Food" },
    ])

    const res = await get()
    const body = await res.json()

    const row = body.monthlyBreakdown[0]
    // Independent label: the route must name the row from the budget key.
    expect(row.label).toBe(
      // e.g. key "2026-08" with a 15th start day is the period 15 Aug - 14 Sep,
      // which the app names after the month it ends in.
      new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        new Date(
          Number(currentKey.split("-")[0]),
          Number(currentKey.split("-")[1]) - 1,
          START_DAY
        )
      ) + ` ${Number(currentKey.split("-")[0])}`
    )
  })

  it("scopes the current-month section to the budget month", async () => {
    const { before, inside } = straddlingTransactions()
    mockFindTransactions.mockResolvedValue([
      { date: before, amount: 100_000, type: "EXPENSE", category: "Food" },
      { date: inside, amount: 250_000, type: "EXPENSE", category: "Food" },
    ])

    const res = await get()
    const body = await res.json()

    // The expense from the previous cycle is outside the current budget month.
    expect(body.currentMonth.expenseTotal).toBe(250_000)
  })

  it("scopes current-month spending categories to the budget month", async () => {
    const { before, inside } = straddlingTransactions()
    mockFindTransactions.mockResolvedValue([
      { date: before, amount: 100_000, type: "EXPENSE", category: "Transport" },
      { date: inside, amount: 250_000, type: "EXPENSE", category: "Food" },
    ])

    const res = await get()
    const body = await res.json()

    const categories = body.currentMonthSpending.map((c: { category: string }) => c.category)
    expect(categories).toContain("Food")
    expect(categories).not.toContain("Transport")
  })
})
