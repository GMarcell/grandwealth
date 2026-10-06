import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockCreate = vi.hoisted(() => vi.fn())
const mockUserFindUnique = vi.hoisted(() => vi.fn())
const mockTransactionFindMany = vi.hoisted(() => vi.fn())

vi.mock("groq-sdk", () => ({
  // Must be a class/function so it works with `new Groq(...)`.
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    transaction: { findMany: mockTransactionFindMany },
  },
}))

const { parseAiBudgetResponse, generateAiBudgetPlanForUser, BudgetAiError } =
  await import("@/lib/budget-ai")

const completion = (content: string, finish_reason = "stop") => ({
  choices: [{ message: { content }, finish_reason }],
})

describe("parseAiBudgetResponse", () => {
  const allowed = ["FOOD", "TRANSPORTATION", "SHOPPING"]

  it("parses fenced JSON and keeps only categories that were spent on", () => {
    const raw = '```json\n{"summary":"Hemat",  "budgets":[' +
      '{"category":"FOOD","amount":1500000.4,"reason":"naik sedikit"},' +
      '{"category":"MADE_UP","amount":99999}' +
      "]}\n```"

    const result = parseAiBudgetResponse(raw, allowed)

    expect(result.summary).toBe("Hemat")
    expect(result.budgets).toEqual([
      { categoryName: "FOOD", amount: 1500000, reason: "naik sedikit" },
    ])
  })

  it("sums duplicate categories and drops non-positive amounts", () => {
    const raw = JSON.stringify({
      budgets: [
        { category: "FOOD", amount: 100000 },
        { category: "FOOD", amount: 50000, reason: "second" },
        { category: "SHOPPING", amount: 0 },
        { category: "TRANSPORTATION", amount: -20 },
      ],
    })

    const result = parseAiBudgetResponse(raw, allowed)

    expect(result.budgets).toEqual([
      { categoryName: "FOOD", amount: 150000, reason: "second" },
    ])
  })

  it("accepts a bare array response", () => {
    const raw = '[{"category":"FOOD","amount":"250000"}]'

    const result = parseAiBudgetResponse(raw, allowed)

    expect(result.budgets).toEqual([
      { categoryName: "FOOD", amount: 250000, reason: null },
    ])
  })

  it("throws a 502 when the response is not usable JSON", () => {
    expect(() => parseAiBudgetResponse("sorry, I cannot help", allowed)).toThrow(
      BudgetAiError,
    )
  })

  it("throws when no allowed category survives", () => {
    const raw = JSON.stringify({ budgets: [{ category: "NOPE", amount: 1000 }] })
    expect(() => parseAiBudgetResponse(raw, allowed)).toThrow(/did not propose/i)
  })
})

describe("generateAiBudgetPlanForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = "test-key"
    mockUserFindUnique.mockResolvedValue({ name: "Test", budgetStartDay: 1 })
    mockTransactionFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    delete process.env.GROQ_API_KEY
  })

  it("plans from the previous budget month's spending", async () => {
    mockTransactionFindMany.mockResolvedValue([
      { type: "EXPENSE", category: "FOOD", amount: 1_000_000 },
      { type: "EXPENSE", category: "FOOD", amount: 500_000 },
      { type: "EXPENSE", category: "TRANSPORTATION", amount: 300_000 },
      { type: "INCOME", category: "SALARY", amount: 8_000_000 },
    ])
    mockCreate.mockResolvedValue(
      completion(
        JSON.stringify({
          summary: "Rencana hemat",
          budgets: [
            { category: "FOOD", amount: 1_400_000 },
            { category: "TRANSPORTATION", amount: 300_000 },
          ],
        }),
      ),
    )

    const plan = await generateAiBudgetPlanForUser("user-1", "2026-09")

    expect(plan.sourceMonth).toBe("2026-08")
    expect(plan.month).toBe("2026-09")
    expect(plan.totalExpenses).toBe(1_800_000)
    expect(plan.totalIncome).toBe(8_000_000)
    expect(plan.totalBudgeted).toBe(1_700_000)
    expect(plan.budgets.map((b) => b.categoryName)).toEqual([
      "FOOD",
      "TRANSPORTATION",
    ])
  })

  it("rejects when the source month has no expenses", async () => {
    mockTransactionFindMany.mockResolvedValue([
      { type: "INCOME", category: "SALARY", amount: 8_000_000 },
    ])

    await expect(
      generateAiBudgetPlanForUser("user-1", "2026-09"),
    ).rejects.toMatchObject({ status: 400 })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("retries with a larger budget when the reply is truncated", async () => {
    mockTransactionFindMany.mockResolvedValue([
      { type: "EXPENSE", category: "FOOD", amount: 1_000_000 },
    ])
    mockCreate
      .mockResolvedValueOnce(completion('{"budgets":[{"category":"FOOD"', "length"))
      .mockResolvedValueOnce(
        completion(
          JSON.stringify({ budgets: [{ category: "FOOD", amount: 900_000 }] }),
        ),
      )

    const plan = await generateAiBudgetPlanForUser("user-1", "2026-09")

    expect(mockCreate).toHaveBeenCalledTimes(2)
    const [firstArgs] = mockCreate.mock.calls[0]
    const [secondArgs] = mockCreate.mock.calls[1]
    expect(secondArgs.max_completion_tokens).toBeGreaterThan(
      firstArgs.max_completion_tokens,
    )
    expect(plan.budgets[0]).toMatchObject({ categoryName: "FOOD", amount: 900_000 })
  })

  it("fails clearly when the API key is missing", async () => {
    delete process.env.GROQ_API_KEY

    await expect(
      generateAiBudgetPlanForUser("user-1", "2026-09"),
    ).rejects.toMatchObject({ status: 503 })
  })
})
