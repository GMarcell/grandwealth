import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockCreate = vi.hoisted(() => vi.fn())
const mockGoalFindUnique = vi.hoisted(() => vi.fn())
const mockUserFindUnique = vi.hoisted(() => vi.fn())
const mockTransactionFindMany = vi.hoisted(() => vi.fn())

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savingsGoal: { findUnique: mockGoalFindUnique },
    user: { findUnique: mockUserFindUnique },
    transaction: { findMany: mockTransactionFindMany },
  },
}))

const {
  monthsUntil,
  feasibilityFrom,
  parseAiGoalPlanResponse,
  generateAiGoalPlanForUser,
  GoalAiError,
} = await import("@/lib/goal-ai")

const completion = (content: string, finish_reason = "stop") => ({
  choices: [{ message: { content }, finish_reason }],
})

const SPENDING = { FOOD: 3_000_000, ENTERTAINMENT: 1_000_000 }

describe("monthsUntil", () => {
  it("rounds a partial month up (at least one)", () => {
    const from = new Date("2026-09-21T12:00:00Z")
    expect(monthsUntil(new Date("2026-12-31T00:00:00Z"), from)).toBe(4)
    expect(monthsUntil(new Date("2026-10-01T00:00:00Z"), from)).toBe(1)
  })

  it("returns 0 for a deadline that is not in the future", () => {
    const from = new Date("2026-09-21T12:00:00Z")
    expect(monthsUntil(new Date("2026-09-21T00:00:00Z"), from)).toBe(0)
  })
})

describe("feasibilityFrom", () => {
  it("classifies by how the required saving compares to capacity", () => {
    expect(feasibilityFrom(1_000_000, 2_000_000)).toBe("ON_TRACK")
    expect(feasibilityFrom(1_000_000, 700_000)).toBe("TIGHT")
    expect(feasibilityFrom(1_000_000, 100_000)).toBe("UNREALISTIC")
    expect(feasibilityFrom(0, 0)).toBe("ON_TRACK")
  })
})

describe("parseAiGoalPlanResponse", () => {
  it("keeps only real categories and caps cuts at what was spent", () => {
    const raw = JSON.stringify({
      summary: "Bisa tercapai",
      feasibility: "tight",
      actions: ["Kurangi jajan", "  ", "Setor otomatis"],
      categoryCuts: [
        { category: "FOOD", monthlySaving: 9_000_000, reason: "masak sendiri" },
        { category: "ENTERTAINMENT", monthlySaving: 300_000 },
        { category: "MADE_UP", monthlySaving: 500_000 },
        { category: "FOOD", monthlySaving: -100 },
      ],
    })

    const result = parseAiGoalPlanResponse(raw, SPENDING)

    expect(result.feasibility).toBe("TIGHT")
    expect(result.actions).toEqual(["Kurangi jajan", "Setor otomatis"])
    // FOOD capped at its 3M spend; unknown category dropped.
    expect(result.categoryCuts).toEqual([
      { category: "FOOD", monthlySaving: 3_000_000, reason: "masak sendiri" },
      { category: "ENTERTAINMENT", monthlySaving: 300_000, reason: null },
    ])
  })

  it("returns null feasibility when the model value is unusable", () => {
    const raw = JSON.stringify({
      summary: "x",
      feasibility: "MAYBE",
      actions: ["a"],
      categoryCuts: [],
    })
    expect(parseAiGoalPlanResponse(raw, SPENDING).feasibility).toBeNull()
  })

  it("throws when nothing usable is returned", () => {
    const raw = JSON.stringify({ summary: "", actions: [], categoryCuts: [] })
    expect(() => parseAiGoalPlanResponse(raw, SPENDING)).toThrow(GoalAiError)
  })
})

describe("generateAiGoalPlanForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"))
    process.env.GROQ_API_KEY = "test-key"

    mockGoalFindUnique.mockResolvedValue({
      id: "goal-1",
      userId: "user-1",
      name: "Emergency fund",
      targetAmount: 12_000_000,
      savedAmount: 2_000_000,
      targetDate: null,
    })
    mockUserFindUnique.mockResolvedValue({ budgetStartDay: 1 })
    mockTransactionFindMany.mockResolvedValue([
      { type: "EXPENSE", category: "FOOD", amount: 3_000_000 },
      { type: "EXPENSE", category: "ENTERTAINMENT", amount: 1_000_000 },
      { type: "EXPENSE", category: "TRANSPORTATION", amount: 1_000_000 },
      { type: "INCOME", category: "SALARY", amount: 8_000_000 },
    ])
    mockCreate.mockResolvedValue(
      completion(
        JSON.stringify({
          summary: "Bisa tercapai",
          feasibility: "ON_TRACK",
          actions: ["Setor otomatis bulanan"],
          categoryCuts: [
            { category: "ENTERTAINMENT", monthlySaving: 300_000, reason: "batasi hiburan" },
          ],
        }),
      ),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.GROQ_API_KEY
  })

  it("computes the required saving and projects capacity from last month", async () => {
    const plan = await generateAiGoalPlanForUser("user-1", "goal-1", "2026-12-31")

    // 10M remaining over 4 months.
    expect(plan.monthsRemaining).toBe(4)
    expect(plan.remaining).toBe(10_000_000)
    expect(plan.requiredMonthlySaving).toBe(2_500_000)

    // Last completed budget month for startDay=1 on 21 Sep 2026 is 2026-08.
    expect(plan.lastMonth.sourceMonth).toBe("2026-08")
    expect(plan.lastMonth.income).toBe(8_000_000)
    expect(plan.lastMonth.expenses).toBe(5_000_000)
    expect(plan.lastMonth.netSaving).toBe(3_000_000)

    expect(plan.categoryCuts).toEqual([
      { category: "ENTERTAINMENT", monthlySaving: 300_000, reason: "batasi hiburan" },
    ])
    expect(plan.projectedMonthlySaving).toBe(3_300_000)
    expect(plan.shortfall).toBe(0)
    expect(plan.feasibility).toBe("ON_TRACK")
  })

  it("falls back to the goal's own target date when no deadline is given", async () => {
    mockGoalFindUnique.mockResolvedValue({
      id: "goal-1",
      userId: "user-1",
      name: "Emergency fund",
      targetAmount: 12_000_000,
      savedAmount: 2_000_000,
      targetDate: new Date("2026-12-31T00:00:00Z"),
    })

    const plan = await generateAiGoalPlanForUser("user-1", "goal-1", null)

    expect(plan.goal.deadline).toBe("2026-12-31")
    expect(plan.monthsRemaining).toBe(4)
  })

  it("requires a deadline when the goal has none", async () => {
    await expect(
      generateAiGoalPlanForUser("user-1", "goal-1", null),
    ).rejects.toMatchObject({ status: 400 })
  })

  it("rejects a past deadline", async () => {
    await expect(
      generateAiGoalPlanForUser("user-1", "goal-1", "2026-01-01"),
    ).rejects.toMatchObject({ status: 400 })
  })

  it("rejects a goal the user does not own", async () => {
    mockGoalFindUnique.mockResolvedValue({
      id: "goal-1",
      userId: "someone-else",
      name: "x",
      targetAmount: 1,
      savedAmount: 0,
      targetDate: null,
    })

    await expect(
      generateAiGoalPlanForUser("user-1", "goal-1", "2026-12-31"),
    ).rejects.toMatchObject({ status: 404 })
  })

  it("rejects a goal that is already reached", async () => {
    mockGoalFindUnique.mockResolvedValue({
      id: "goal-1",
      userId: "user-1",
      name: "x",
      targetAmount: 1_000_000,
      savedAmount: 1_000_000,
      targetDate: null,
    })

    await expect(
      generateAiGoalPlanForUser("user-1", "goal-1", "2026-12-31"),
    ).rejects.toMatchObject({ status: 400 })
  })

  it("rejects when the source month has no expenses", async () => {
    mockTransactionFindMany.mockResolvedValue([
      { type: "INCOME", category: "SALARY", amount: 8_000_000 },
    ])

    await expect(
      generateAiGoalPlanForUser("user-1", "goal-1", "2026-12-31"),
    ).rejects.toMatchObject({ status: 400 })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("fails clearly when the API key is missing", async () => {
    delete process.env.GROQ_API_KEY

    await expect(
      generateAiGoalPlanForUser("user-1", "goal-1", "2026-12-31"),
    ).rejects.toMatchObject({ status: 503 })
  })
})
