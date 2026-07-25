import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const { rateLimitState } = vi.hoisted(() => {
  const perKey: Record<string, number> = {}
  return {
    rateLimitState: {
      perKey,
      /** Reset all counters — called in beforeEach */
      resetAll() {
        for (const k of Object.keys(perKey)) delete perKey[k]
      },
      /** Get or create a counter for a given key */
      getCounter(key: string) {
        if (!(key in perKey)) perKey[key] = 0
        return perKey[key]
      },
      /** Increment a key's counter */
      increment(key: string) {
        if (!(key in perKey)) perKey[key] = 0
        return ++perKey[key]
      },
    },
  }
})

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

// Track calls to rateLimit for assertion
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      delete: mockDelete,
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Import after mocks
const { DELETE } = await import("../route")

// ─── Helpers ─────────────────────────────────

function makeRequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/user/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...headers },
  })
}

function setupMockRateLimit() {
  mockRateLimit.mockImplementation(
    async (key: string, options: { limit?: number; windowMs?: number }) => {
      const count = rateLimitState.increment(key)
      const limit = options?.limit ?? 2
      const allowed = count <= limit
      return {
        allowed,
        remaining: allowed ? Math.max(0, limit - count) : 0,
        resetTime: Date.now() + (options?.windowMs ?? 600_000),
        limit,
      }
    },
  )
}

function setupUserFound() {
  mockFindUnique.mockResolvedValue({ id: "user-1" })
  mockDelete.mockResolvedValue({ id: "user-1" })
}

// ─── Tests ───────────────────────────────────

describe("DELETE /api/user/account — auth & errors", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitState.resetAll()
  })

  it("returns 401 when user is not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const response = await DELETE(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValueOnce({ user: {} })

    const response = await DELETE(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("returns 404 when user exists in session but not in database", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    setupMockRateLimit()
    mockFindUnique.mockResolvedValueOnce(null)

    const response = await DELETE(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: "User not found" })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" }, select: { id: true } })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("returns 200 and deletes the user on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    setupMockRateLimit()
    setupUserFound()

    const response = await DELETE(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" }, select: { id: true } })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "user-1" } })
  })

  it("returns 500 when findUnique throws a database error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    setupMockRateLimit()
    mockFindUnique.mockRejectedValueOnce(new Error("Connection refused"))

    const response = await DELETE(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "Failed to delete account" })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("returns 500 when delete throws a database error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    setupMockRateLimit()
    mockFindUnique.mockResolvedValueOnce({ id: "user-1" })
    mockDelete.mockRejectedValueOnce(new Error("Constraint violation"))

    const response = await DELETE(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "Failed to delete account" })
    expect(mockFindUnique).toHaveBeenCalled()
    expect(mockDelete).toHaveBeenCalled()
  })
})

describe("DELETE /api/user/account — rate limit configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitState.resetAll()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    setupMockRateLimit()
  })

  it("uses the correct rate-limit key format: 'delete-account:' prefix + IP", async () => {
    mockGetRateLimitKey.mockReturnValue("192.168.1.100")
    setupUserFound()

    await DELETE(makeRequest())

    expect(mockRateLimit).toHaveBeenCalledWith(
      "delete-account:192.168.1.100",
      expect.any(Object),
    )
  })

  it("passes limit=2 to the rate-limit function", async () => {
    setupUserFound()

    await DELETE(makeRequest())

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 2 }),
    )
  })

  it("passes windowMs=600000 (10 minutes) to the rate-limit function", async () => {
    setupUserFound()

    await DELETE(makeRequest())

    expect(mockRateLimit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ windowMs: 600_000 }),
    )
  })

  it("allows exactly 2 requests within the window", async () => {
    setupUserFound()

    // First request should succeed
    const res1 = await DELETE(makeRequest())
    expect(res1.status).toBe(200)

    // Second request should still succeed
    const res2 = await DELETE(makeRequest())
    expect(res2.status).toBe(200)

    // Third request should be blocked
    const res3 = await DELETE(makeRequest())
    expect(res3.status).toBe(429)
  })

  it("returns Retry-After header with positive seconds on 429", async () => {
    setupUserFound()

    await DELETE(makeRequest())
    await DELETE(makeRequest())
    const response = await DELETE(makeRequest())

    expect(response.status).toBe(429)
    const retryAfter = response.headers.get("Retry-After")
    expect(retryAfter).toBeTruthy()
    expect(Number(retryAfter)).toBeGreaterThan(0)
  })

  it("returns 429 with correct error message", async () => {
    setupUserFound()

    await DELETE(makeRequest())
    await DELETE(makeRequest())
    const response = await DELETE(makeRequest())
    const body = await response.json()

    expect(body).toEqual({ error: "Too many attempts. Please try again later." })
  })

  it("gives independent rate-limit buckets to different IPs", async () => {
    setupUserFound()

    // First IP: exhaust its 2 requests
    mockGetRateLimitKey.mockReturnValue("203.0.113.1")
    await DELETE(makeRequest())
    await DELETE(makeRequest())
    expect((await DELETE(makeRequest())).status).toBe(429)

    // Second IP: should still have its own fresh bucket
    mockGetRateLimitKey.mockReturnValue("198.51.100.2")
    expect((await DELETE(makeRequest())).status).toBe(200)

    // Second IP: uses its second request
    expect((await DELETE(makeRequest())).status).toBe(200)

    // Second IP: third request blocked
    expect((await DELETE(makeRequest())).status).toBe(429)

    // First IP: still blocked even after other IP made requests
    mockGetRateLimitKey.mockReturnValue("203.0.113.1")
    expect((await DELETE(makeRequest())).status).toBe(429)
  })

  it("does not rate-limit when auth fails (returns 401 before rate limit check)", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const response = await DELETE(makeRequest())

    expect(response.status).toBe(401)
    // rateLimit should NOT have been called
    expect(mockRateLimit).not.toHaveBeenCalled()
  })

  it("extracts IP from x-forwarded-for header via getRateLimitKey", async () => {
    setupUserFound()
    mockGetRateLimitKey.mockImplementation(
      (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    )

    const req = makeRequest({ "x-forwarded-for": "10.0.0.50" })
    await DELETE(req)

    expect(mockRateLimit).toHaveBeenCalledWith(
      "delete-account:10.0.0.50",
      expect.any(Object),
    )
  })
})
