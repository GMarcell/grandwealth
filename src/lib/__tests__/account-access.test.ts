import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFindUnique = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mockFindUnique } },
}))

const { getAccessRecord } = await import("../account-access")

const RECORD = {
  role: "ADMIN",
  plan: "PRO",
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  suspended: false,
}

describe("getAccessRecord", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches only the entitlement fields for the given user", async () => {
    mockFindUnique.mockResolvedValue(RECORD)

    const result = await getAccessRecord("user-1")

    expect(result).toEqual(RECORD)
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        role: true,
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        suspended: true,
      },
    })
  })

  it("returns null when the account no longer exists", async () => {
    mockFindUnique.mockResolvedValue(null)

    expect(await getAccessRecord("gone")).toBeNull()
  })
})
