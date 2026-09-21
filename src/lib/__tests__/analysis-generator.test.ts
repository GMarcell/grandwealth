import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockCreate = vi.hoisted(() => vi.fn())

const mockUserFindUnique = vi.hoisted(() => vi.fn())
const mockTransactionFindMany = vi.hoisted(() => vi.fn())
const mockBudgetFindMany = vi.hoisted(() => vi.fn())
const mockStockFindMany = vi.hoisted(() => vi.fn())
const mockGoldFindMany = vi.hoisted(() => vi.fn())
const mockAnalysisUpsert = vi.hoisted(() => vi.fn())

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
    budget: { findMany: mockBudgetFindMany },
    stock: { findMany: mockStockFindMany },
    goldDeposit: { findMany: mockGoldFindMany },
    monthlyAnalysis: { upsert: mockAnalysisUpsert },
  },
}))

const { generateAnalysisForUserAndMonth } = await import(
  "@/lib/analysis-generator"
)

const completion = (content: string, finish_reason: string) => ({
  choices: [{ message: { content }, finish_reason }],
})

describe("generateAnalysisForUserAndMonth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = "test-key"

    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Test",
      budgetStartDay: 1,
      carryOverEnabled: true,
    })
    mockTransactionFindMany.mockResolvedValue([])
    mockBudgetFindMany.mockResolvedValue([])
    mockStockFindMany.mockResolvedValue([])
    mockGoldFindMany.mockResolvedValue([])
    mockAnalysisUpsert.mockResolvedValue({})
  })

  afterEach(() => {
    delete process.env.GROQ_API_KEY
  })

  it("stores the AI summary", async () => {
    mockCreate.mockResolvedValue(completion("full report", "stop"))

    const result = await generateAnalysisForUserAndMonth("user-1", "2026-08")

    expect(result.summary).toBe("full report")
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockAnalysisUpsert).toHaveBeenCalled()
  })

  it("retries with a larger budget when the model hits the token cap", async () => {
    mockCreate
      .mockResolvedValueOnce(completion("cut off mid", "length"))
      .mockResolvedValueOnce(
        completion("cut off mid-sentence and the rest of the report", "stop"),
      )

    const result = await generateAnalysisForUserAndMonth("user-1", "2026-08")

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.summary).toContain("the rest of the report")

    const [firstArgs] = mockCreate.mock.calls[0]
    const [secondArgs] = mockCreate.mock.calls[1]
    expect(secondArgs.max_completion_tokens).toBeGreaterThan(
      firstArgs.max_completion_tokens,
    )
  })

  it("throws instead of storing an empty analysis", async () => {
    mockCreate.mockResolvedValue(completion("", "stop"))

    await expect(
      generateAnalysisForUserAndMonth("user-1", "2026-08"),
    ).rejects.toThrow(/empty/i)
    expect(mockAnalysisUpsert).not.toHaveBeenCalled()
  })
})
