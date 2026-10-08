import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockUserFindUnique = vi.hoisted(() => vi.fn())
const mockTransactionFindMany = vi.hoisted(() => vi.fn())
const mockCategoryFindMany = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    transaction: { findMany: mockTransactionFindMany },
    category: { findMany: mockCategoryFindMany },
  },
}))

const { generateBudgetPlanForUser, buildPlanSummary, BudgetPlanError } =
  await import("@/lib/budget-planner")

const CATEGORIES = [
  { name: "FOOD", ruleType: "NEED" },
  { name: "ENTERTAINMENT", ruleType: "WANT" },
  { name: "EMERGENCY", ruleType: "SAVINGS" },
]

const SOURCE_TX = [
  { type: "EXPENSE", category: "FOOD", amount: 3_000_000 },
  { type: "EXPENSE", category: "ENTERTAINMENT", amount: 1_000_000 },
  { type: "EXPENSE", category: "EMERGENCY", amount: 500_000 },
]

describe("buildPlanSummary", () => {
  it("describes the rule and the income base", () => {
    const summary = buildPlanSummary({
      monthLabel: "Sep 2026",
      sourceMonthLabel: "Aug 2026",
      incomeMonthLabel: "Sep 2026",
      income: 10_000_000,
      skippedGroups: [],
    })

    expect(summary).toMatch(/50\/30\/20/)
    expect(summary).toContain("10.000.000")
    expect(summary).not.toMatch(/belum dialokasikan/i)
  })

  it("names the skipped group in English", () => {
    const summary = buildPlanSummary({
      monthLabel: "Sep 2026",
      sourceMonthLabel: "Aug 2026",
      incomeMonthLabel: "Sep 2026",
      income: 10_000_000,
      skippedGroups: ["WANT"],
    })

    expect(summary).toContain("wants")
  })
})

describe("generateBudgetPlanForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ budgetStartDay: 1 })
    mockCategoryFindMany.mockResolvedValue(CATEGORIES)
    // The source-month query has no `type` filter; the income query does.
    mockTransactionFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args?.where?.type === "INCOME") return []
      return SOURCE_TX
    })
  })

  it("splits by 50/30/20 and weights each group by last month's spending", async () => {
    // Target month has income, so it is used as the base.
    mockTransactionFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args?.where?.type === "INCOME") return [{ amount: 10_000_000 }]
      return SOURCE_TX
    })

    const plan = await generateBudgetPlanForUser("user-1", "2026-09")

    expect(plan.sourceMonth).toBe("2026-08")
    expect(plan.incomeMonth).toBe("2026-09")
    expect(plan.income).toBe(10_000_000)
    expect(plan.totalExpenses).toBe(4_500_000)
    // 50% need (5M), 30% want (3M), 20% savings (2M).
    expect(plan.budgets).toEqual([
      { categoryName: "FOOD", amount: 5_000_000, ruleType: "NEED", spent: 3_000_000 },
      {
        categoryName: "ENTERTAINMENT",
        amount: 3_000_000,
        ruleType: "WANT",
        spent: 1_000_000,
      },
      {
        categoryName: "EMERGENCY",
        amount: 2_000_000,
        ruleType: "SAVINGS",
        spent: 500_000,
      },
    ])
    expect(plan.totalBudgeted).toBe(10_000_000)
    expect(plan.skippedGroups).toEqual([])
  })

  it("falls back to last month's income when the target month has none", async () => {
    mockTransactionFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args?.where?.type === "INCOME") return []
      return [...SOURCE_TX, { type: "INCOME", category: "SALARY", amount: 8_000_000 }]
    })

    const plan = await generateBudgetPlanForUser("user-1", "2026-09")

    expect(plan.income).toBe(8_000_000)
    expect(plan.incomeMonth).toBe("2026-08")
  })

  it("only allocates to classified categories that had spending", async () => {
    // FOOD is classified but had no spending -> excluded. UNCLASSIFIED spent
    // but has no rule -> excluded.
    mockTransactionFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args?.where?.type === "INCOME") return [{ amount: 10_000_000 }]
      return [
        { type: "EXPENSE", category: "ENTERTAINMENT", amount: 1_000_000 },
        { type: "EXPENSE", category: "UNCLASSIFIED", amount: 900_000 },
      ]
    })

    const plan = await generateBudgetPlanForUser("user-1", "2026-09")

    expect(plan.budgets.map((b) => b.categoryName)).toEqual(["ENTERTAINMENT"])
    // NEED and SAVINGS groups had no eligible category.
    expect(plan.skippedGroups.sort()).toEqual(["NEED", "SAVINGS"])
  })

  it("rejects when the source month has no expenses", async () => {
    mockTransactionFindMany.mockImplementation(async (args: { where?: { type?: string } }) => {
      if (args?.where?.type === "INCOME") return []
      return [{ type: "INCOME", category: "SALARY", amount: 8_000_000 }]
    })

    await expect(generateBudgetPlanForUser("user-1", "2026-09")).rejects.toMatchObject({
      status: 400,
    })
  })

  it("rejects when no classified category had spending", async () => {
    mockCategoryFindMany.mockResolvedValue([])

    await expect(generateBudgetPlanForUser("user-1", "2026-09")).rejects.toBeInstanceOf(
      BudgetPlanError,
    )
  })
})
