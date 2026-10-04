import { cache } from "react"
import { prisma } from "@/lib/prisma"
import type { Plan, Role, SubscriptionStatus } from "@prisma/client"

/**
 * The account fields that decide request-time entitlements.
 *
 * A single request typically reads these more than once: `auth()` checks
 * `suspended` to honor admin suspensions, and Pro/admin routes then call
 * `requireProAccess` / `requireAdminAccess`, which need the plan and role.
 * Wrapping the lookup in React's `cache` collapses all of those into one
 * database read per request (per unique user id). Outside a request scope
 * `cache` is a pass-through, so this stays correct in tests.
 */
export interface AccessRecord {
  role: Role
  plan: Plan
  subscriptionStatus: SubscriptionStatus | null
  currentPeriodEnd: Date | null
  suspended: boolean
}

const ACCESS_SELECT = {
  role: true,
  plan: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
  suspended: true,
} as const

export const getAccessRecord = cache(
  async (userId: string): Promise<AccessRecord | null> => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: ACCESS_SELECT,
    })
  },
)
