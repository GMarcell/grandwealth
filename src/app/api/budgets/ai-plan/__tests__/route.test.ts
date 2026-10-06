import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

// ─── Hoisted mocks (available before module instantiation) ───

const mockRequireProPlus = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockBudgetFindMany = vi.hoisted(() => vi.fn())
const mockBudgetUpsert = vi.hoisted(() => vi.fn())

const mocks = vi.hoisted(() => {
  // Real class shape so `instanceof BudgetAiError` works in the route.
  class TestBudgetAiError extends Error {
    status: number
    constructor(message: string, status = 500) {
      super(message)
      this.status = status
      this.name = "BudgetAiError"
    }
  }
  return { generate: vi.fn(), BudgetAiError: TestBudgetAiError }
})

vi.mock("@/lib/api-access", () => ({ requireAdminOrProPlusUser: mockRequireProPlus }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }))
vi.mock("@/lib/prisma", () => ({
  prisma: { budget: { findMany: mockBudgetFindMany, upsert: mockBudgetUpsert } },
}))
vi.mock("@/lib/budget-ai", () => ({
  generateAiBudgetPlanForUser: mocks.generate,
  BudgetAiError: mocks.BudgetAiError,
}))

const { POST } = await import("../route")

const plan = {
  month: "2026-09",
  sourceMonth: "2026-08",
  summary: "Rencana hemat",
  totalIncome: 8_000_000,
  totalExpenses: 1_800_000,
  totalBudgeted: 1_700_000,
  budgets: [
    { categoryName: "FOOD", amount: 1_400_000, reason: null },
    { categoryName: "TRANSPORTATION", amount: 300_000, reason: null },
  ],
}

const post = (body: unknown) =>
  new Request("http://localhost/api/budgets/ai-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /api/budgets/ai-plan (Pro+/admin only)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireProPlus.mockResolvedValue("user-1")
    mockRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: Date.now() + 60_000,
    })
    mocks.generate.mockResolvedValue(plan)
    mockBudgetFindMany.mockResolvedValue([])
    mockBudgetUpsert.mockResolvedValue({})
  })

  it("rejects a non-entitled user before calling the AI", async () => {
    // requireAdminOrProPlusUser returns a 403 for a signed-in Pro (or free)
    // account that is neither Pro+ nor an admin.
    mockRequireProPlus.mockResolvedValue(
      NextResponse.json({ error: "Pro+ subscription required" }, { status: 403 }),
    )

    const res = await POST(post({ month: "2026-09" }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/pro\+/i)
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mockBudgetUpsert).not.toHaveBeenCalled()
  })

  it("returns a preview without writing budgets by default", async () => {
    const res = await POST(post({ month: "2026-09" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.applied).toBe(false)
    expect(body.plan).toEqual(plan)
    expect(mockBudgetUpsert).not.toHaveBeenCalled()
  })

  it("applies the plan and reports created/updated counts", async () => {
    // FOOD already exists for the month; TRANSPORTATION is new.
    mockBudgetFindMany.mockResolvedValue([{ categoryName: "FOOD" }])

    const res = await POST(post({ month: "2026-09", apply: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.applied).toBe(true)
    expect(body.created).toBe(1)
    expect(body.updated).toBe(1)
    expect(mockBudgetUpsert).toHaveBeenCalledTimes(2)
    expect(mockBudgetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categoryName_month_userId: {
            categoryName: "FOOD",
            month: "2026-09",
            userId: "user-1",
          },
        },
        update: { amount: 1_400_000 },
      }),
    )
  })

  it("rejects a malformed month before calling the AI", async () => {
    const res = await POST(post({ month: "2026-9" }))

    expect(res.status).toBe(400)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it("surfaces a BudgetAiError with its HTTP status", async () => {
    mocks.generate.mockRejectedValue(
      new mocks.BudgetAiError("No expenses found in Aug 2026", 400),
    )

    const res = await POST(post({ month: "2026-09" }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/no expenses/i)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    })

    const res = await POST(post({ month: "2026-09" }))

    expect(res.status).toBe(429)
    expect(mocks.generate).not.toHaveBeenCalled()
  })
})
