import { describe, it, expect, vi, beforeEach } from "vitest"
import { DEFAULT_PASSWORD } from "@/lib/password"

// ─── Hoisted mocks ────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockHash = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mockFindUnique, update: mockUpdate } },
}))

vi.mock("bcryptjs", () => ({ hash: mockHash }))

// Import after mocks
const { POST } = await import("../route")

// ─── Helpers ─────────────────────────────────

const ADMIN_SELECT = {
  role: "ADMIN",
  plan: "PRO",
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  suspended: false,
}

const FREE_SELECT = { ...ADMIN_SELECT, role: "USER", plan: "FREE", subscriptionStatus: null }

/** Admin actor + the target row returned by the route's own lookup. */
function setupAdminActingOn(target: { id: string } | null) {
  mockAuth.mockResolvedValue({ user: { id: "admin-1" } })
  // First findUnique = admin guard lookup, second = target lookup.
  mockFindUnique.mockResolvedValueOnce(ADMIN_SELECT).mockResolvedValue(target)
}

function call(id: string) {
  return POST(new Request(`http://localhost/api/admin/users/${id}/reset-password`, {
    method: "POST",
  }), { params: Promise.resolve({ id }) })
}

describe("POST /api/admin/users/[id]/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHash.mockResolvedValue("hashed-default")
    mockUpdate.mockResolvedValue({})
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await call("user-2")

    expect(res.status).toBe(401)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns 403 for non-admin callers", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUnique.mockResolvedValueOnce(FREE_SELECT)

    const res = await call("user-2")

    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns 404 when the target user does not exist", async () => {
    setupAdminActingOn(null)

    const res = await call("missing")

    expect(res.status).toBe(404)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("resets the password to the default and reports it back", async () => {
    setupAdminActingOn({ id: "user-2" })

    const res = await call("user-2")

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      defaultPassword: DEFAULT_PASSWORD,
    })
    expect(mockHash).toHaveBeenCalledWith(DEFAULT_PASSWORD, 12)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { password: "hashed-default" },
    })
  })

  it("returns 500 when the update fails", async () => {
    setupAdminActingOn({ id: "user-2" })
    mockUpdate.mockRejectedValue(new Error("db down"))

    const res = await call("user-2")

    expect(res.status).toBe(500)
  })
})
