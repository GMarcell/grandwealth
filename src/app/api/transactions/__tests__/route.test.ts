import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())
const mockGroupBy = vi.hoisted(() => vi.fn())
const mockFindCategories = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    transaction: {
      findMany: mockFindMany,
      count: mockCount,
      groupBy: mockGroupBy,
    },
    category: { findMany: mockFindCategories },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Import after mocks
const { GET } = await import("../route")

// ─── Helpers ─────────────────────────────────

const tx = (
  id: string,
  type: "INCOME" | "EXPENSE",
  category: string,
  amount: number,
) => ({
  id,
  type,
  category,
  amount,
  description: `${id} desc`,
  date: new Date(2026, 8, 10, 12, 0, 0),
})

interface SetupOptions {
  transactions?: Array<ReturnType<typeof tx>>
  total?: number
  typeRows?: Array<{ type: string; _sum: { amount: number } }>
  categoryRows?: Array<{ category: string; _sum: { amount: number | null } }>
  budgetStartDay?: number
  categories?: Array<{ name: string; ruleType: string | null }>
}

/** Wire up the happy-path mocks for an authenticated GET request. */
function setupMocks({
  transactions = [],
  total,
  typeRows = [],
  categoryRows = [],
  budgetStartDay = 1,
  categories = [],
}: SetupOptions = {}) {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockGetRateLimitKey.mockReturnValue("ip-1")
  mockFindUser.mockResolvedValue({ budgetStartDay })
  mockFindMany.mockResolvedValue(transactions)
  mockCount.mockResolvedValue(total ?? transactions.length)
  mockFindCategories.mockResolvedValue(categories)

  // groupBy is called once (by type) or twice (by type + by category).
  // Resolve based on the `by` argument so leftover "once" queues from earlier
  // tests can never leak into this one.
  mockGroupBy.mockReset()
  mockGroupBy.mockImplementation(
    (args: { by: string[] }) =>
      Promise.resolve(args.by[0] === "category" ? categoryRows : typeRows),
  )
}

const TYPE_TOTALS = [
  { type: "INCOME", _sum: { amount: 5_000_000 } },
  { type: "EXPENSE", _sum: { amount: 2_000_000 } },
]

// ─── Tests ───────────────────────────────────

describe("GET /api/transactions — auth & rate limit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET(new Request("http://localhost/api/transactions?page=1"))

    expect(res.status).toBe(401)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockRateLimit.mockResolvedValue({ allowed: false })

    const res = await GET(new Request("http://localhost/api/transactions?page=1"))

    expect(res.status).toBe(429)
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})

describe("GET /api/transactions — month filter", () => {
  beforeEach(() => vi.clearAllMocks())

  it("scopes the query to the budget month using the user's start day", async () => {
    // startDay=28 → "2026-08" is the period 28 Aug – 27 Sep.
    setupMocks({ budgetStartDay: 28, typeRows: TYPE_TOTALS })

    const res = await GET(
      new Request("http://localhost/api/transactions?page=1&pageSize=50&month=2026-08"),
    )
    expect(res.status).toBe(200)

    const where = mockFindMany.mock.calls[0][0].where
    expect(where.userId).toBe("user-1")
    expect(where.date).toEqual({
      gte: new Date(2026, 7, 28), // 28 Aug
      // 27 Sep, end-of-day so transactions dated on the last day count.
      lte: new Date(2026, 8, 27, 23, 59, 59, 999),
    })
    expect(mockFindUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { budgetStartDay: true },
    })
  })

  it("treats startDay=1 as a plain calendar month", async () => {
    setupMocks({ budgetStartDay: 1, typeRows: TYPE_TOTALS })

    await GET(
      new Request("http://localhost/api/transactions?page=1&month=2026-08"),
    )

    expect(mockFindMany.mock.calls[0][0].where.date).toEqual({
      gte: new Date(2026, 7, 1),
      lte: new Date(2026, 7, 31, 23, 59, 59, 999),
    })
  })

  it("applies no date window for month=ALL", async () => {
    setupMocks({ typeRows: TYPE_TOTALS })

    await GET(new Request("http://localhost/api/transactions?page=1&month=ALL"))

    expect(mockFindMany.mock.calls[0][0].where.date).toBeUndefined()
    // No budget settings lookup needed without a month window.
    expect(mockFindUser).not.toHaveBeenCalled()
  })
})

describe("GET /api/transactions — rule filter", () => {
  beforeEach(() => vi.clearAllMocks())

  const categories = [
    { name: "FOOD", ruleType: "NEED" },
    { name: "HOUSING", ruleType: "NEED" },
    { name: "SHOPPING", ruleType: "WANT" },
    { name: "EMERGENCY_FUND", ruleType: "SAVINGS" },
    { name: "OTHER_EXPENSE", ruleType: null },
  ]

  it("restricts to category names classified as the requested rule", async () => {
    setupMocks({ categories, typeRows: TYPE_TOTALS })

    await GET(new Request("http://localhost/api/transactions?page=1&rule=NEED"))

    expect(mockFindMany.mock.calls[0][0].where.category).toEqual({
      in: ["FOOD", "HOUSING"],
    })
  })

  it("supports the WANT and SAVINGS rules", async () => {
    setupMocks({ categories, typeRows: TYPE_TOTALS })

    await GET(new Request("http://localhost/api/transactions?page=1&rule=WANT"))
    expect(mockFindMany.mock.calls[0][0].where.category).toEqual({
      in: ["SHOPPING"],
    })

    vi.clearAllMocks()
    setupMocks({ categories, typeRows: TYPE_TOTALS })
    await GET(new Request("http://localhost/api/transactions?page=1&rule=SAVINGS"))
    expect(mockFindMany.mock.calls[0][0].where.category).toEqual({
      in: ["EMERGENCY_FUND"],
    })
  })

  it("treats OTHER as every category without a rule type", async () => {
    setupMocks({ categories, typeRows: TYPE_TOTALS })

    await GET(new Request("http://localhost/api/transactions?page=1&rule=OTHER"))

    // Only categories mapped to NEED/WANT/SAVINGS are excluded; uncategorized
    // names (not present in the Category table) therefore still match.
    expect(mockFindMany.mock.calls[0][0].where.category).toEqual({
      notIn: ["FOOD", "HOUSING", "SHOPPING", "EMERGENCY_FUND"],
    })
  })

  it("applies no category restriction for rule=ALL", async () => {
    setupMocks({ typeRows: TYPE_TOTALS })

    await GET(new Request("http://localhost/api/transactions?page=1&rule=ALL"))

    expect(mockFindMany.mock.calls[0][0].where.category).toBeUndefined()
    expect(mockFindCategories).not.toHaveBeenCalled()
  })
})

describe("GET /api/transactions — summary totals", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns income and expense totals across the whole filtered set", async () => {
    setupMocks({
      // Only one row is on this page, but the totals cover every match.
      transactions: [tx("t-1", "EXPENSE", "FOOD", 1_000)],
      total: 120,
      typeRows: TYPE_TOTALS,
    })

    const res = await GET(
      new Request("http://localhost/api/transactions?page=2&pageSize=50"),
    )
    const body = await res.json()

    expect(body.summary.totalIncome).toBe(5_000_000)
    expect(body.summary.totalExpenses).toBe(2_000_000)
    expect(body.summary.byCategory).toBeUndefined()
  })

  it("computes the summary with the same filter but without pagination", async () => {
    setupMocks({ typeRows: TYPE_TOTALS })

    await GET(
      new Request(
        "http://localhost/api/transactions?page=3&pageSize=50&search=gaji&type=EXPENSE&month=2026-08",
      ),
    )

    const listArgs = mockFindMany.mock.calls[0][0]
    const summaryArgs = mockGroupBy.mock.calls[0][0]

    // Same `where` object shared by the list, count, and summary…
    expect(summaryArgs.where).toEqual(listArgs.where)
    expect(mockCount).toHaveBeenCalledWith({ where: listArgs.where })

    // …but the summary has no skip/take, so pagination can't under-count it.
    expect(summaryArgs.skip).toBeUndefined()
    expect(summaryArgs.take).toBeUndefined()
    expect(listArgs.skip).toBe(100) // (page 3 - 1) * pageSize 50
    expect(summaryArgs.by).toEqual(["type"])
  })

  it("includes per-category spend when summaryByCategory=1", async () => {
    setupMocks({
      typeRows: TYPE_TOTALS,
      categoryRows: [
        { category: "FOOD", _sum: { amount: 1_200_000 } },
        { category: "HOUSING", _sum: { amount: null } },
      ],
    })

    const res = await GET(
      new Request(
        "http://localhost/api/transactions?page=1&pageSize=1&month=2026-08&type=EXPENSE&summaryByCategory=1",
      ),
    )
    const body = await res.json()

    expect(mockGroupBy.mock.calls[1][0].by).toEqual(["category"])
    expect(mockGroupBy.mock.calls[1][0].where).toEqual(
      mockFindMany.mock.calls[0][0].where,
    )
    expect(body.summary.byCategory).toEqual({ FOOD: 1_200_000, HOUSING: 0 })
  })

  it("returns zeroed totals when there are no matching transactions", async () => {
    setupMocks({ typeRows: [] })

    const res = await GET(new Request("http://localhost/api/transactions?page=1"))
    const body = await res.json()

    expect(body.summary.totalIncome).toBe(0)
    expect(body.summary.totalExpenses).toBe(0)
  })
})
