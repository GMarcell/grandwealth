import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks ────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockExpire = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    trialRequest: { count: mockCount, findMany: mockFindMany },
  },
}))

vi.mock("@/lib/trial", () => ({ expireLapsedTrials: mockExpire }))

// Import after mocks
const { GET } = await import("../route")

// ─── Helpers ─────────────────────────────────

/** What `requireAdminAccess` reads on its guard lookup. */
const ADMIN_SELECT = {
  role: "ADMIN",
  plan: "PRO",
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  suspended: false,
}

function request(query = "") {
  return new Request(`http://localhost/api/admin/trial-requests${query}`)
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    status: "PENDING",
    message: "please",
    decisionNote: null,
    decidedById: null,
    decidedAt: null,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    user: {
      id: "user-2",
      name: "Jane",
      email: "jane@example.com",
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      isTrial: false,
      suspended: false,
    },
    ...overrides,
  }
}

describe("GET /api/admin/trial-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "admin-1" } })
    mockFindUser.mockResolvedValue(ADMIN_SELECT)
    mockExpire.mockResolvedValue(0)
    mockCount.mockResolvedValue(1)
    mockFindMany.mockResolvedValue([row()])
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET(request())

    expect(res.status).toBe(401)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("returns 403 for non-admin callers", async () => {
    mockFindUser.mockResolvedValue({ ...ADMIN_SELECT, role: "USER", plan: "FREE" })

    const res = await GET(request())

    expect(res.status).toBe(403)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("lists requests with the pending ones first", async () => {
    const res = await GET(request("?status=PENDING"))

    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: 0,
        take: 20,
      })
    )
  })

  it("serializes dates and paginates", async () => {
    mockCount.mockResolvedValue(25)

    const body = await (await GET(request("?page=2&pageSize=10"))).json()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
    expect(body.data[0]).toMatchObject({
      id: "req-1",
      status: "PENDING",
      createdAt: "2026-09-01T10:00:00.000Z",
      decidedAt: null,
      user: { email: "jane@example.com" },
    })
    expect(body.pagination).toMatchObject({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasMore: true,
    })
  })

  it("omits the status filter when none is given", async () => {
    await GET(request())

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it("rejects an unknown status", async () => {
    const res = await GET(request("?status=NOPE"))

    expect(res.status).toBe(400)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("returns 500 when the query fails", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"))

    const res = await GET(request())

    expect(res.status).toBe(500)
  })
})
