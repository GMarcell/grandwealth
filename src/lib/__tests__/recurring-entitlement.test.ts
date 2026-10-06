import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFindMany = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recurringTransaction: { findMany: mockFindMany },
  },
}))

const { applyDueRecurringTransactions } = await import("../recurring")

describe("applyDueRecurringTransactions — plan scope", () => {
  beforeEach(() => vi.clearAllMocks())

  it("includes both paid tiers (Pro and Pro+) so Pro+ owners keep automating", async () => {
    mockFindMany.mockResolvedValue([])

    await applyDueRecurringTransactions(new Date("2026-09-21T00:00:00Z"))

    const where = mockFindMany.mock.calls[0][0].where
    expect(where.user.plan).toEqual({ in: ["PRO", "PRO_PLUS"] })
    expect(where.user.subscriptionStatus).toBe("ACTIVE")
    expect(where.user.suspended).toBe(false)
  })
})
