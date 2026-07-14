/**
 * Simple in-memory rate limiter.
 *
 * IMPORTANT: This is a per-process, in-memory rate limiter.
 * - On Vercel (serverless): Each invocation is a separate process, so limits reset per request.
 *   For true distributed rate limiting, replace with Upstash Ratelimit or similar.
 * - On a long-running server (Node.js): Works correctly within a single process.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60 seconds
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now >= entry.resetTime) {
      store.delete(key)
    }
  }
}

interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. Default: 10 */
  limit?: number
  /** Time window in milliseconds. Default: 10000 (10 seconds) */
  windowMs?: number
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining in the current window */
  remaining: number
  /** Unix timestamp (ms) when the window resets */
  resetTime: number
  /** Total limit for the window */
  limit: number
}

export function rateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  cleanup()

  const { limit = 10, windowMs = 10_000 } = options
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || now >= entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs, limit }
  }

  entry.count++

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime, limit }
  }

  return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime, limit }
}

/**
 * Get a rate limit key from a request object.
 * Uses the user's IP (from headers or connecting IP) as the identifier.
 */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown"
  return `ratelimit:${ip}`
}
