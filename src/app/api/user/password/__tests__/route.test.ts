import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks ────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockUpdateUser = vi.hoisted(() => vi.fn())
const mockCompare = vi.hoisted(() => vi.fn())
const mockHash = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mockFindUser, update: mockUpdateUser } },
}))

vi.mock("bcryptjs", () => ({ compare: mockCompare, hash: mockHash }))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Import after mocks
const { PATCH } = await import("../route")

// ─── Helpers ─────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/user/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/user/password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockGetRateLimitKey.mockReturnValue("ip-1")
    mockRateLimit.mockResolvedValue({ allowed: true })
    mockFindUser.mockResolvedValue({ password: "stored-hash" })
    mockCompare.mockResolvedValue(true)
    mockHash.mockResolvedValue("new-hash")
    mockUpdateUser.mockResolvedValue({})
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await PATCH(makeRequest({ newPassword: "newpass123" }))

    expect(res.status).toBe(401)
    expect(mockFindUser).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      resetTime: Date.now() + 60_000,
    })

    const res = await PATCH(makeRequest({ newPassword: "newpass123" }))

    expect(res.status).toBe(429)
    expect(mockFindUser).not.toHaveBeenCalled()
  })

  it("rejects a new password shorter than the minimum", async () => {
    const res = await PATCH(makeRequest({ currentPassword: "old", newPassword: "12345" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Password must be at least 6 characters")
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("requires the current password when the account has one", async () => {
    const res = await PATCH(makeRequest({ newPassword: "newpass123" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Current password is required")
    expect(mockCompare).not.toHaveBeenCalled()
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("rejects an incorrect current password without writing", async () => {
    mockCompare.mockResolvedValue(false)

    const res = await PATCH(
      makeRequest({ currentPassword: "wrong", newPassword: "newpass123" })
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Current password is incorrect")
    expect(mockCompare).toHaveBeenCalledWith("wrong", "stored-hash")
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("hashes and stores the new password", async () => {
    const res = await PATCH(
      makeRequest({ currentPassword: "oldpass", newPassword: "newpass123" })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockCompare).toHaveBeenCalledWith("oldpass", "stored-hash")
    expect(mockHash).toHaveBeenCalledWith("newpass123", 12)
    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "new-hash" },
    })
  })

  it("sets a first password for accounts that have none (OAuth-only)", async () => {
    mockFindUser.mockResolvedValue({ password: null })

    const res = await PATCH(makeRequest({ newPassword: "newpass123" }))

    expect(res.status).toBe(200)
    expect(mockCompare).not.toHaveBeenCalled()
    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "new-hash" },
    })
  })

  it("returns 401 when the account no longer exists", async () => {
    mockFindUser.mockResolvedValue(null)

    const res = await PATCH(
      makeRequest({ currentPassword: "oldpass", newPassword: "newpass123" })
    )

    expect(res.status).toBe(401)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("returns 500 when the update fails", async () => {
    mockUpdateUser.mockRejectedValue(new Error("db down"))

    const res = await PATCH(
      makeRequest({ currentPassword: "oldpass", newPassword: "newpass123" })
    )

    expect(res.status).toBe(500)
  })
})
