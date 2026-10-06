import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

// ─── Hoisted mocks (available before module instantiation) ───

const mockRequireProPlus = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())

const mocks = vi.hoisted(() => {
  // Real class shape so `instanceof GoalAiError` works in the route.
  class TestGoalAiError extends Error {
    status: number
    constructor(message: string, status = 500) {
      super(message)
      this.status = status
      this.name = "GoalAiError"
    }
  }
  return { generate: vi.fn(), GoalAiError: TestGoalAiError }
})

vi.mock("@/lib/api-access", () => ({ requireAdminOrProPlusUser: mockRequireProPlus }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }))
vi.mock("@/lib/goal-ai", () => ({
  generateAiGoalPlanForUser: mocks.generate,
  GoalAiError: mocks.GoalAiError,
}))

const { POST } = await import("../route")

const plan = {
  goal: {
    id: "goal-1",
    name: "Emergency fund",
    targetAmount: 12_000_000,
    savedAmount: 2_000_000,
    deadline: "2026-12-31",
  },
  monthsRemaining: 4,
  remaining: 10_000_000,
  requiredMonthlySaving: 2_500_000,
  lastMonth: {
    sourceMonth: "2026-08",
    income: 8_000_000,
    expenses: 5_000_000,
    netSaving: 3_000_000,
    categories: [{ name: "FOOD", spent: 3_000_000 }],
  },
  summary: "Bisa tercapai",
  feasibility: "ON_TRACK",
  actions: ["Setor otomatis bulanan"],
  categoryCuts: [],
  projectedMonthlySaving: 3_000_000,
  shortfall: 0,
}

const post = (body: unknown) =>
  new Request("http://localhost/api/goals/ai-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /api/goals/ai-plan (Pro+/admin only)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireProPlus.mockResolvedValue("user-1")
    mockRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: Date.now() + 60_000,
    })
    mocks.generate.mockResolvedValue(plan)
  })

  it("rejects a non-entitled user before calling the AI", async () => {
    mockRequireProPlus.mockResolvedValue(
      NextResponse.json({ error: "Pro+ subscription required" }, { status: 403 }),
    )

    const res = await POST(post({ goalId: "goal-1", deadline: "2026-12-31" }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toMatch(/pro\+/i)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it("returns the generated plan", async () => {
    const res = await POST(post({ goalId: "goal-1", deadline: "2026-12-31" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.plan).toEqual(plan)
    expect(mocks.generate).toHaveBeenCalledWith("user-1", "goal-1", "2026-12-31", expect.objectContaining({
      includeSavings: true,
      includeGold: true,
      includeSellStocks: true,
    }))
  })

  it("allows omitting the deadline (falls back to the goal's target date)", async () => {
    const res = await POST(post({ goalId: "goal-1" }))

    expect(res.status).toBe(200)
    expect(mocks.generate).toHaveBeenCalledWith("user-1", "goal-1", null, expect.objectContaining({
      includeSavings: true,
      includeGold: true,
      includeSellStocks: true,
    }))
  })

  it("rejects a missing goalId before calling the AI", async () => {
    const res = await POST(post({ deadline: "2026-12-31" }))

    expect(res.status).toBe(400)
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it("surfaces a GoalAiError with its HTTP status", async () => {
    mocks.generate.mockRejectedValue(
      new mocks.GoalAiError("The deadline must be in the future", 400),
    )

    const res = await POST(post({ goalId: "goal-1", deadline: "2026-01-01" }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/deadline/i)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    })

    const res = await POST(post({ goalId: "goal-1", deadline: "2026-12-31" }))

    expect(res.status).toBe(429)
    expect(mocks.generate).not.toHaveBeenCalled()
  })
})
