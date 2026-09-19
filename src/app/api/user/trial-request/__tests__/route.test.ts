import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks ────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindRequests = vi.hoisted(() => vi.fn())
const mockCreateRequest = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())
const mockNotifyAdmins = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    trialRequest: { findMany: mockFindRequests, create: mockCreateRequest },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

vi.mock("@/lib/trial-request", async () => {
  const actual = await vi.importActual<typeof import("@/lib/trial-request")>(
    "@/lib/trial-request"
  )
  return { ...actual, notifyAdminsOfTrialRequest: mockNotifyAdmins }
})

// Import after mocks
const { GET, POST } = await import("../route")

// ─── Helpers ─────────────────────────────────

const FREE_USER = {
  name: "Jane",
  email: "jane@example.com",
  role: "USER" as const,
  plan: "FREE" as const,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  isTrial: false,
  suspended: false,
}

const PRO_USER = {
  ...FREE_USER,
  plan: "PRO" as const,
  subscriptionStatus: "ACTIVE" as const,
  isTrial: true,
  currentPeriodEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
}

function post(body: unknown = {}) {
  return POST(
    new Request("http://localhost/api/user/trial-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

describe("GET /api/user/trial-request", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUser.mockResolvedValue(FREE_USER)
    mockFindRequests.mockResolvedValue([])
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(mockFindUser).not.toHaveBeenCalled()
  })

  it("reports that a Free user may request a trial", async () => {
    const body = await (await GET()).json()

    expect(body).toMatchObject({
      status: null,
      canRequest: true,
      hasUsedTrial: false,
      onTrial: false,
      isPro: false,
    })
  })

  it("reports a pending request", async () => {
    mockFindRequests.mockResolvedValue([
      { status: "PENDING", message: "please", createdAt: new Date(), decidedAt: null },
    ])

    const body = await (await GET()).json()

    expect(body.status).toBe("PENDING")
    expect(body.canRequest).toBe(false)
  })

  it("reports a running trial's end date", async () => {
    mockFindUser.mockResolvedValue(PRO_USER)
    mockFindRequests.mockResolvedValue([
      { status: "APPROVED", message: null, createdAt: new Date(), decidedAt: new Date() },
    ])

    const body = await (await GET()).json()

    expect(body.onTrial).toBe(true)
    expect(body.trialEndsAt).toBe(PRO_USER.currentPeriodEnd.toISOString())
    expect(body.canRequest).toBe(false)
  })
})

describe("POST /api/user/trial-request", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockGetRateLimitKey.mockReturnValue("ip-1")
    mockRateLimit.mockResolvedValue({ allowed: true })
    mockFindUser.mockResolvedValue(FREE_USER)
    mockFindRequests.mockResolvedValue([])
    mockCreateRequest.mockResolvedValue({ id: "req-1" })
    mockNotifyAdmins.mockResolvedValue(1)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await post()

    expect(res.status).toBe(401)
    expect(mockCreateRequest).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({
      allowed: false,
      resetTime: Date.now() + 60_000,
    })

    const res = await post()

    expect(res.status).toBe(429)
    expect(mockCreateRequest).not.toHaveBeenCalled()
  })

  it("creates a pending request and notifies the admins", async () => {
    const res = await post({ message: "  I want to try budgets  " })

    expect(res.status).toBe(201)
    expect(mockCreateRequest).toHaveBeenCalledWith({
      data: { userId: "user-1", message: "I want to try budgets" },
    })
    expect(mockNotifyAdmins).toHaveBeenCalledWith({
      userName: "Jane",
      userEmail: "jane@example.com",
      message: "I want to try budgets",
    })
  })

  it("stores an empty message as null", async () => {
    await post({})

    expect(mockCreateRequest).toHaveBeenCalledWith({
      data: { userId: "user-1", message: null },
    })
  })

  it("rejects a duplicate request while one is pending", async () => {
    mockFindRequests.mockResolvedValue([
      { status: "PENDING", message: null, createdAt: new Date(), decidedAt: null },
    ])

    const res = await post()

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      "You already have a trial request awaiting review"
    )
    expect(mockCreateRequest).not.toHaveBeenCalled()
  })

  it("rejects a request from a user who already had a trial", async () => {
    mockFindRequests.mockResolvedValue([
      { status: "APPROVED", message: null, createdAt: new Date(), decidedAt: new Date() },
    ])

    const res = await post()

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      "Your Pro trial has already been used"
    )
    expect(mockCreateRequest).not.toHaveBeenCalled()
  })

  it("rejects a request from a user who already has Pro", async () => {
    mockFindUser.mockResolvedValue(PRO_USER)

    const res = await post()

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      "Your account is already on the Pro plan"
    )
    expect(mockCreateRequest).not.toHaveBeenCalled()
  })

  it("caps the message length", async () => {
    const res = await post({ message: "x".repeat(501) })

    expect(res.status).toBe(400)
    expect(mockCreateRequest).not.toHaveBeenCalled()
  })

  it("still succeeds when notifying the admins fails", async () => {
    mockNotifyAdmins.mockRejectedValue(new Error("smtp down"))

    const res = await post()

    expect(res.status).toBe(201)
    expect(mockCreateRequest).toHaveBeenCalled()
  })

  it("returns 500 when the request can't be stored", async () => {
    mockCreateRequest.mockRejectedValue(new Error("db down"))

    const res = await post()

    expect(res.status).toBe(500)
  })
})
