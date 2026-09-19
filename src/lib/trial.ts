import { prisma } from "@/lib/prisma"

/**
 * Downgrade Pro accounts whose free trial has ended back to Free.
 *
 * Entitlement is already enforced lazily — `isProUser` denies access the
 * moment `currentPeriodEnd` passes — so this sweep is housekeeping: it keeps
 * the stored plan/status truthful so admin listings, filters, and the MRR
 * figure don't show lapsed trials as active subscribers.
 *
 * Idempotent and cheap (runs `updateMany` with a narrow where). Called by the
 * periodic crons and by the admin / self-service endpoints that read live
 * subscription state.
 */
export async function expireLapsedTrials(now: Date = new Date()): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      plan: "PRO",
      isTrial: true,
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: { lt: now },
    },
    data: {
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      isTrial: false,
    },
  })
  return result.count
}
