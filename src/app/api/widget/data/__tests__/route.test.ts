import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockResolveWidgetToken = vi.hoisted(() => vi.fn())
const mockUserFindUnique = vi.hoisted(() => vi.fn())

vi.mock("@/lib/widget-token", () => ({
  WIDGET_TOKEN_HEADER: "x-widget-token",
  resolveWidgetToken: mockResolveWidgetToken,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    transaction: { findMany: vi.fn(), groupBy: vi.fn() },
    goldDeposit: { findMany: vi.fn() },
    stock: { findMany: vi.fn() },
    bankSaving: { findMany: vi.fn() },
    loan: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
  },
}))

// Import after mocks
const { GET } = await import("../route")

const makeRequest = (token?: string) =>
  new Request("http://localhost/api/widget/data", {
    headers: token ? { "x-widget-token": token } : {},
  })

describe("GET /api/widget/data — authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when the widget token is invalid", async () => {
    mockResolveWidgetToken.mockResolvedValue(null)

    const res = await GET(makeRequest("bogus"))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe("Invalid widget token")
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  it("returns 401 when no token is presented", async () => {
    mockResolveWidgetToken.mockResolvedValue(null)

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 401 when the token owner has been deleted", async () => {
    mockResolveWidgetToken.mockResolvedValue({ userId: "user-1" })
    mockUserFindUnique.mockResolvedValue(null)

    const res = await GET(makeRequest("gw_widget_x"))
    expect(res.status).toBe(401)
  })

  it("returns 401 for a suspended account", async () => {
    mockResolveWidgetToken.mockResolvedValue({ userId: "user-1" })
    mockUserFindUnique.mockResolvedValue({ budgetStartDay: 1, suspended: true })

    const res = await GET(makeRequest("gw_widget_x"))
    const body = await res.json()

    // A suspended account loses widget access just like it loses every other
    // authenticated surface.
    expect(res.status).toBe(401)
    expect(body.error).toBe("Invalid widget token")
  })

  it("looks up the owner including the suspended flag", async () => {
    mockResolveWidgetToken.mockResolvedValue({ userId: "user-1" })
    mockUserFindUnique.mockResolvedValue({ budgetStartDay: 1, suspended: true })

    await GET(makeRequest("gw_widget_x"))

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        budgetStartDay: true,
        suspended: true,
        role: true,
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
      },
    })
  })
})
