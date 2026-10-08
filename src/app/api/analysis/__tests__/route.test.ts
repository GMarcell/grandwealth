import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockRequirePro = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockGenerate = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetAccessRecord = vi.hoisted(() => vi.fn())
const mockQuotaCount = vi.hoisted(() => vi.fn())
const mockQuotaCreate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/api-access", () => ({ requireProUser: mockRequirePro }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    monthlyAnalysis: { findUnique: vi.fn(), findMany: vi.fn() },
    aiUsage: { count: mockQuotaCount, create: mockQuotaCreate },
  },
}))
vi.mock("@/lib/analysis-generator", () => ({
  generateAnalysisForUserAndMonth: mockGenerate,
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: () => "test-key",
}))
vi.mock("@/lib/account-access", () => ({
  getAccessRecord: mockGetAccessRecord,
}))

// Import after mocks
const { POST } = await import("../route")

const post = (month: string) =>
  new Request("http://localhost/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month }),
  })

describe("POST /api/analysis — rejects still-running budget months", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 21, 12, 0, 0)) // 21 Sep 2026

    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockRequirePro.mockResolvedValue("user-1")
    mockGetAccessRecord.mockResolvedValue({
      role: "USER",
      plan: "PRO_PLUS",
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: null,
      suspended: false,
    })
    mockQuotaCount.mockResolvedValue(0)
    mockQuotaCreate.mockResolvedValue({ id: "usage-1" })
    mockRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetTime: Date.now() + 60_000,
    })
    mockGenerate.mockResolvedValue({ summary: "ok" })
  })

  afterEach(() => vi.useRealTimers())

  it("blocks the running period for a 28th-start cycle", async () => {
    // Current period is 28 Aug – 27 Sep, which has not ended on 21 Sep, so the
    // last complete month is 2026-07 (28 Jul – 27 Aug).
    mockFindUser.mockResolvedValue({ budgetStartDay: 28 })

    const res = await POST(post("2026-08"))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/not complete/i)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("allows the last completed period for a 28th-start cycle", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 28 })

    const res = await POST(post("2026-07"))

    expect(res.status).toBe(200)
    expect(mockGenerate).toHaveBeenCalledWith("user-1", "2026-07")
  })

  it("blocks the current calendar month when startDay is 1", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 1 })

    const res = await POST(post("2026-09"))

    expect(res.status).toBe(400)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("allows the previous calendar month when startDay is 1", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 1 })

    const res = await POST(post("2026-08"))

    expect(res.status).toBe(200)
    expect(mockGenerate).toHaveBeenCalledWith("user-1", "2026-08")
  })

  it("still rejects a malformed month", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 1 })

    const res = await POST(post("2026-9"))

    expect(res.status).toBe(400)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("blocks a Pro account that has reached the monthly Groq quota", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 1 })
    mockGetAccessRecord.mockResolvedValue({
      role: "USER",
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: null,
      suspended: false,
    })
    mockQuotaCount.mockResolvedValue(5)

    const res = await POST(post("2026-08"))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toMatch(/monthly Groq AI limit/i)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("allows a Pro account and burns one quota token after a successful generation", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 1 })
    mockGetAccessRecord.mockResolvedValue({
      role: "USER",
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: null,
      suspended: false,
    })
    mockQuotaCount.mockResolvedValue(2)
    mockQuotaCreate.mockResolvedValue({ id: "usage-1" })

    const res = await POST(post("2026-08"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockGenerate).toHaveBeenCalledWith("user-1", "2026-08")
    expect(mockQuotaCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", monthKey: "2026-09" },
    })
    expect(body.quota).toMatchObject({
      limit: 5,
      remaining: 2,
    })
  })

  it("does not apply the monthly Groq quota to a Pro+ account", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 1 })
    mockGetAccessRecord.mockResolvedValue({
      role: "USER",
      plan: "PRO_PLUS",
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: null,
      suspended: false,
    })
    mockQuotaCount.mockResolvedValue(999)

    const res = await POST(post("2026-08"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockGenerate).toHaveBeenCalledWith("user-1", "2026-08")
    expect(body.quota.limit).toBe(0)
    expect(body.quota.remaining).toBeGreaterThan(0)
  })

  it("does not apply the monthly Groq quota to an admin account", async () => {
    mockFindUser.mockResolvedValue({ budgetStartDay: 1 })
    mockGetAccessRecord.mockResolvedValue({
      role: "ADMIN",
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      suspended: false,
    })
    mockQuotaCount.mockResolvedValue(999)

    const res = await POST(post("2026-08"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockGenerate).toHaveBeenCalledWith("user-1", "2026-08")
    expect(body.quota.limit).toBe(0)
    expect(body.quota.remaining).toBeGreaterThan(0)
  })
})
