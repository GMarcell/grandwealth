import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks ───────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockUpdateUser = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mockFindUser, update: mockUpdateUser } },
}))

// Import after mocks
const { GET, PATCH } = await import("../route")

// ─── Helpers ─────────────────────────────────

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/user/budget-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

// ─── Tests ───────────────────────────────────

describe("GET /api/user/budget-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns the start day and carry-over setting", async () => {
    mockFindUser.mockResolvedValue({
      budgetStartDay: 28,
      carryOverEnabled: false,
    })

    const body = await (await GET()).json()
    expect(body).toEqual({ budgetStartDay: 28, carryOverEnabled: false })
  })

  it("falls back to defaults when the user row is missing", async () => {
    mockFindUser.mockResolvedValue(null)
    const body = await (await GET()).json()
    expect(body).toEqual({ budgetStartDay: 1, carryOverEnabled: true })
  })
})

describe("PATCH /api/user/budget-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockUpdateUser.mockResolvedValue({
      budgetStartDay: 1,
      carryOverEnabled: false,
    })
  })

  it("updates carry-over on its own", async () => {
    const res = await patch({ carryOverEnabled: false })
    expect(res.status).toBe(200)

    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { carryOverEnabled: false },
      select: { budgetStartDay: true, carryOverEnabled: true },
    })
    expect(await res.json()).toEqual({
      budgetStartDay: 1,
      carryOverEnabled: false,
    })
  })

  it("can update both settings at once", async () => {
    mockUpdateUser.mockResolvedValue({
      budgetStartDay: 15,
      carryOverEnabled: true,
    })

    const res = await patch({ budgetStartDay: 15, carryOverEnabled: true })
    expect(res.status).toBe(200)
    expect(mockUpdateUser.mock.calls[0][0].data).toEqual({
      budgetStartDay: 15,
      carryOverEnabled: true,
    })
  })

  it("rejects a non-boolean carry-over value", async () => {
    const res = await patch({ carryOverEnabled: "yes" })
    expect(res.status).toBe(400)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("rejects an out-of-range start day", async () => {
    expect((await patch({ budgetStartDay: 0 })).status).toBe(400)
    expect((await patch({ budgetStartDay: 29 })).status).toBe(400)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("rejects a request with no supported settings", async () => {
    const res = await patch({})
    expect(res.status).toBe(400)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await patch({ carryOverEnabled: false })
    expect(res.status).toBe(401)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})
