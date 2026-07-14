import { describe, it, expect } from "vitest"
import { rateLimit, getRateLimitKey } from "../rate-limit"

// Note: The rate limit store is module-level, so tests using the same key
// will interact. We use unique keys per test to avoid interference.

describe("rateLimit", () => {
  it("allows the first request", () => {
    const result = rateLimit("test:first-request", { limit: 5, windowMs: 10_000 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.limit).toBe(5)
    expect(result.resetTime).toBeGreaterThan(Date.now())
  })

  it("allows requests up to the limit", () => {
    const key = `test:within-limit-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      const result = rateLimit(key, { limit: 5, windowMs: 10_000 })
      if (i < 5) {
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(5 - i - 1)
      }
    }
  })

  it("blocks requests over the limit", () => {
    const key = `test:over-limit-${Date.now()}`
    // Exhaust all 5 requests
    for (let i = 0; i < 5; i++) {
      rateLimit(key, { limit: 5, windowMs: 10_000 })
    }
    // 6th request should be blocked
    const result = rateLimit(key, { limit: 5, windowMs: 10_000 })
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("uses default options when not provided", () => {
    const key = `test:defaults-${Date.now()}`
    // Defaults: limit=10, windowMs=10_000
    const result = rateLimit(key)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(9)
  })

  it("respects custom windowMs and resets after window expires", async () => {
    const key = `test:window-reset-${Date.now()}`
    // Use a very short window (10ms)
    const result1 = rateLimit(key, { limit: 1, windowMs: 50 })
    expect(result1.allowed).toBe(true)

    // Immediately, second request should be blocked
    const result2 = rateLimit(key, { limit: 1, windowMs: 50 })
    expect(result2.allowed).toBe(false)

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60))

    // After window expires, should be allowed again
    const result3 = rateLimit(key, { limit: 1, windowMs: 50 })
    expect(result3.allowed).toBe(true)
  }, 10_000) // timeout for this test

  it("tracks remaining correctly", () => {
    const key = `test:remaining-${Date.now()}`
    const r1 = rateLimit(key, { limit: 3, windowMs: 10_000 })
    expect(r1.remaining).toBe(2)

    const r2 = rateLimit(key, { limit: 3, windowMs: 10_000 })
    expect(r2.remaining).toBe(1)

    const r3 = rateLimit(key, { limit: 3, windowMs: 10_000 })
    expect(r3.remaining).toBe(0)
    expect(r3.allowed).toBe(true)

    const r4 = rateLimit(key, { limit: 3, windowMs: 10_000 })
    expect(r4.remaining).toBe(0)
    expect(r4.allowed).toBe(false)
  })

  it("handles different keys independently", () => {
    const keyA = `test:independent-a-${Date.now()}`
    const keyB = `test:independent-b-${Date.now()}`

    // Exhaust keyA
    rateLimit(keyA, { limit: 1, windowMs: 10_000 })
    expect(rateLimit(keyA, { limit: 1, windowMs: 10_000 }).allowed).toBe(false)

    // keyB should still be allowed
    expect(rateLimit(keyB, { limit: 1, windowMs: 10_000 }).allowed).toBe(true)
  })

  it("uses a limit of 1 correctly", () => {
    const key = `test:limit-one-${Date.now()}`
    const r1 = rateLimit(key, { limit: 1, windowMs: 10_000 })
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(0)

    const r2 = rateLimit(key, { limit: 1, windowMs: 10_000 })
    expect(r2.allowed).toBe(false)
  })

  it("handles high limits", () => {
    const key = `test:high-limit-${Date.now()}`
    const limit = 100
    for (let i = 0; i < limit; i++) {
      const result = rateLimit(key, { limit, windowMs: 10_000 })
      expect(result.allowed).toBe(true)
    }
    // Next one should be blocked
    expect(rateLimit(key, { limit, windowMs: 10_000 }).allowed).toBe(false)
  })

  it("returns consistent resetTime within the same window", () => {
    const key = `test:reset-time-${Date.now()}`
    const r1 = rateLimit(key, { limit: 3, windowMs: 60_000 })
    const r2 = rateLimit(key, { limit: 3, windowMs: 60_000 })
    expect(r1.resetTime).toBe(r2.resetTime)
  })
})

describe("getRateLimitKey", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    })
    expect(getRateLimitKey(request)).toBe("ratelimit:192.168.1.1")
  })

  it("uses the first IP when multiple are present", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.1, 198.51.100.2, 10.0.0.1" },
    })
    expect(getRateLimitKey(request)).toBe("ratelimit:203.0.113.1")
  })

  it("handles spaces in x-forwarded-for values", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": " 192.168.1.1 " },
    })
    expect(getRateLimitKey(request)).toBe("ratelimit:192.168.1.1")
  })

  it('returns "unknown" when x-forwarded-for is not set', () => {
    const request = new Request("http://localhost")
    expect(getRateLimitKey(request)).toBe("ratelimit:unknown")
  })
})
