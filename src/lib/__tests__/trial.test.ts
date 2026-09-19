import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks ────────────────────────────

const mockUpdateMany = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      updateMany: mockUpdateMany,
    },
  },
}))

const { expireLapsedTrials } = await import("../trial")

describe("expireLapsedTrials", () => {
  beforeEach(() => vi.clearAllMocks())

  it("downgrades lapsed trials back to Free", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 })

    const now = new Date("2026-06-01T00:00:00Z")
    const count = await expireLapsedTrials(now)

    expect(count).toBe(2)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        plan: "PRO",
        isTrial: true,
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { lt: now },
      },
      data: {
        plan: "FREE",
        subscriptionStatus: null,
        currentPeriodEnd: null,
        isTrial: false,
      },
    })
  })

  it("returns zero when there is nothing to expire", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const count = await expireLapsedTrials()

    expect(count).toBe(0)
  })

  it("is safe to run repeatedly (idempotent by construction)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 })
    await expireLapsedTrials()
    await expireLapsedTrials()
    expect(mockUpdateMany).toHaveBeenCalledTimes(2)
  })
})
