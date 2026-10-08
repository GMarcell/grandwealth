/**
 * Monthly Groq AI usage quota.
 *
 * Pro accounts are capped at `PRO_GROQ_MONTHLY_LIMIT` Groq invocations per
 * calendar month. Pro+ accounts and administrators are not capped (they can
 * call Groq-powered endpoints freely).
 *
 * "Groq invocations" means any API route that calls the Groq SDK on behalf of
 * the user — currently:
 *   - POST /api/analysis                 (monthly analysis generation)
 *   - POST /api/budgets/ai-plan         (AI budget plan)
 *   - POST /api/goals/ai-plan           (AI goal plan)
 *
 * The quota is scoped to the calendar month of the first invocation so a user
 * who starts mid-month keeps their remaining budget until the month rolls over.
 * Counts are stored in the prisma `aiUsage` table so they survive serverless
 * restarts and work without Redis.
 */

import { prisma } from "@/lib/prisma"
import { isAdminUser, isProPlusUser } from "@/lib/subscription"
import { getAccessRecord } from "@/lib/account-access"

/**
 * Serialize a quota remaining value for JSON responses.
 *
 * `Infinity` is not valid JSON, so unlimited accounts get a sentinel large
 * number that clients can treat as "unlimited".
 */
export function serializeQuotaRemaining(remaining: number): number {
  if (!Number.isFinite(remaining)) return Number.MAX_SAFE_INTEGER
  return remaining
}

export const PRO_GROQ_MONTHLY_LIMIT = 5

/** Shape of a quota check result. */
export interface GroqQuotaResult {
  /** Whether the request is allowed to proceed. */
  allowed: boolean
  /** Remaining Groq calls this calendar month (0 when capped out). */
  remaining: number
  /** When the monthly window rolls over, as an ISO timestamp. */
  resetAt: string
  /** Total cap for the window (0 means no cap / unlimited). */
  limit: number
}

/**
 * Resolve the quota window for `userId`.
 *
 * Returns `{ allowed: true, remaining: Infinity, resetAt, limit: 0 }` for
 * Pro+ and admin accounts (no cap), and either allows or denies for Pro
 * accounts based on how many Groq calls they have already made this month.
 */
export async function checkGroqQuota(
  userId: string,
): Promise<GroqQuotaResult> {
  const user = await getAccessRecord(userId)
  if (!user) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date().toISOString(),
      limit: 0,
    }
  }

  // Pro+ and admins are never capped.
  if (isProPlusUser(user) || isAdminUser(user)) {
    const resetAt = nextMonthReset()
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt,
      limit: 0,
    }
  }

  // Pro accounts (non-Pro+): apply monthly cap.
  const now = new Date()
  const monthKey = monthKeyFor(now)
  const used = await prisma.aiUsage.count({
    where: { userId, monthKey },
  })

  if (used >= PRO_GROQ_MONTHLY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: nextMonthReset(),
      limit: PRO_GROQ_MONTHLY_LIMIT,
    }
  }

  return {
    allowed: true,
    remaining: PRO_GROQ_MONTHLY_LIMIT - used,
    resetAt: nextMonthReset(),
    limit: PRO_GROQ_MONTHLY_LIMIT,
  }
}

/**
 * Record one Groq invocation for `userId` if one is allowed.
 *
 * Call this AFTER the business logic has started using Groq (ideally as close
 * to the actual Groq call as possible) so aborted/failed requests before the
 * Groq call do not burn quota. Returns the updated remaining count.
 */
export async function consumeGroqQuota(userId: string): Promise<number> {
  const user = await getAccessRecord(userId)
  if (!user) return 0
  if (isProPlusUser(user) || isAdminUser(user)) return Number.POSITIVE_INFINITY

  const monthKey = monthKeyFor(new Date())
  const used = await prisma.aiUsage.count({ where: { userId, monthKey } })
  if (used >= PRO_GROQ_MONTHLY_LIMIT) return 0

  await prisma.aiUsage.create({
    data: { userId, monthKey },
  })

  return PRO_GROQ_MONTHLY_LIMIT - (used + 1)
}

/** Calendar-month key, e.g. "2026-09". */
function monthKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** ISO timestamp at the start of the next calendar month (well, start of next month). */
function nextMonthReset(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
  return next.toISOString()
}
