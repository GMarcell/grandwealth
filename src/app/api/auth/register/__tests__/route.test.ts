import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockHash = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())

vi.mock("bcryptjs", () => ({ hash: mockHash }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Import after mocks
const { POST } = await import("../route")

// ─── Helpers ─────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function setupMocks() {
  mockGetRateLimitKey.mockReturnValue("ip-1")
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockHash.mockResolvedValue("hashed-password")
  mockFindUnique.mockResolvedValue(null)
  mockCreate.mockResolvedValue({})
}

// ─── Tests ───────────────────────────────────

describe("POST /api/auth/register — rate limit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 429 when rate limited", async () => {
    setupMocks()
    mockRateLimit.mockResolvedValue({ allowed: false, resetTime: Date.now() + 60_000 })

    const res = await POST(makeRequest({ email: "user@example.com", password: "secure123" }))
    expect(res.status).toBe(429)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe("POST /api/auth/register — email normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it("stores the email lowercased and trimmed", async () => {
    const res = await POST(
      makeRequest({ email: "  User@Example.COM  ", password: "secure123", name: "John" })
    )

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const data = mockCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      name: "John",
      email: "user@example.com",
      password: "hashed-password",
    })
  })

  it("treats a mixed-case duplicate as already registered (case-insensitive check)", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing-user" })

    const res = await POST(
      makeRequest({ email: "USER@example.com", password: "secure123" })
    )
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe("Email already registered")
    // The duplicate lookup uses the normalized lowercase email.
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe("POST /api/auth/register — Pro trial grant", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
    delete process.env.ADMIN_EMAILS
  })

  it("grants new users an active 14-day Pro trial", async () => {
    const res = await POST(
      makeRequest({ email: "user@example.com", password: "secure123" })
    )

    expect(res.status).toBe(200)
    const data = mockCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      email: "user@example.com",
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      isTrial: true,
    })
    const trialEnd = data.currentPeriodEnd as Date
    const expectedEnd = Date.now() + 14 * 24 * 60 * 60 * 1000
    expect(trialEnd.getTime()).toBeGreaterThan(expectedEnd - 60_000)
    expect(trialEnd.getTime()).toBeLessThan(expectedEnd + 60_000)
  })

  it("does not grant a trial to bootstrap admins", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com"

    const res = await POST(
      makeRequest({ email: "boss@example.com", password: "secure123" })
    )

    expect(res.status).toBe(200)
    const data = mockCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ email: "boss@example.com", role: "ADMIN" })
    // Admins don't need a trial — schema defaults (FREE plan, no subscription).
    expect(data.plan).toBeUndefined()
    expect(data.isTrial).toBeUndefined()
  })
})