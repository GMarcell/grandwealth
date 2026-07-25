/**
 * Distributed rate limiter using Upstash Ratelimit.
 *
 * When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are configured, rate
 * limiting is persisted in Upstash Redis and works across all serverless
 * invocations on Vercel.
 *
 * Falls back to an in-memory implementation when the env vars are absent,
 * which is safe for local development.
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// ─── Types (shared by both implementations) ────

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. Default: 10 */
  limit?: number
  /** Time window in milliseconds. Default: 10000 (10 seconds) */
  windowMs?: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining in the current window */
  remaining: number
  /** Unix timestamp (ms) when the window resets */
  resetTime: number
  /** Total limit for the window */
  limit: number
}

// ─── Upstash backend (distributed) ────────────

const useUpstash = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

let redisClient: Redis | null = null
const upstashRatelimiters = new Map<string, Ratelimit>()

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv()
  }
  return redisClient
}

function getUpstashRatelimit(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`
  if (!upstashRatelimiters.has(key)) {
    upstashRatelimiters.set(
      key,
      new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(limit, `${Math.floor(windowMs / 1000)} s`),
        prefix: "grandwealth",
        analytics: true,
      }),
    )
  }
  return upstashRatelimiters.get(key)!
}

// ─── In-memory fallback (local development) ───

interface InMemoryEntry {
  count: number
  resetTime: number
}

const store = new Map<string, InMemoryEntry>()

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

function inMemoryRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
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

// ─── Public API ───────────────────────────────

/**
 * Check whether a given key (e.g. "register:1.2.3.4") is allowed within its
 * rate-limit window.
 *
 * When Upstash Redis is configured, the check is persisted and works across
 * all serverless invocations.  Otherwise, an in-memory fallback is used.
 */
export async function rateLimit(
  key: string,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  if (useUpstash) {
    const { limit = 10, windowMs = 10_000 } = options
    const ratelimit = getUpstashRatelimit(limit, windowMs)
    const { success, limit: l, remaining, reset } = await ratelimit.limit(key)
    return {
      allowed: success,
      remaining,
      resetTime: reset,
      limit: l,
    }
  }

  return inMemoryRateLimit(key, options)
}

/**
 * Derive a rate-limit key from the incoming request.
 * Uses the client IP (from x-forwarded-for) as the identifier.
 */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown"
  return ip
}
