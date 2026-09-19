import type { Plan, Role, SubscriptionStatus } from "@prisma/client"

/**
 * Monthly price of the Pro plan in IDR. Used for the admin overview's
 * "potential MRR" figure. Subscriptions are granted manually by admins
 * today (see README), so this is informational — when an online billing
 * gateway is added later, this becomes the checkout amount.
 */
export const PRO_PRICE_IDR = 39_000

/** Length of the Pro trial an administrator grants, in days. */
export const PRO_TRIAL_DAYS = 30

/**
 * When a trial started at `from` ends. Used when an admin approves a trial
 * request; the account drops back to FREE at this instant (see
 * `expireLapsedTrials`).
 */
export function proTrialPeriodEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000)
}

/** The minimal user shape required to decide plan entitlements. */
export interface EntitlementUser {
  role: Role
  plan: Plan
  subscriptionStatus: SubscriptionStatus | null
  currentPeriodEnd: Date | string | null
  suspended: boolean
}

/** True when the user is an active administrator (never paywalled). */
export function isAdminUser(user: Pick<EntitlementUser, "role" | "suspended">): boolean {
  return !user.suspended && user.role === "ADMIN"
}

/**
 * True when the user can use Pro features.
 *
 * Rules:
 * - Suspended users never have access.
 * - Admins always have access (useful for testing + support).
 * - Regular users need plan PRO with an ACTIVE subscription, and their
 *   current period must not have ended (when a period end is set).
 */
export function isProUser(user: EntitlementUser): boolean {
  if (user.suspended) return false
  if (isAdminUser(user)) return true
  if (user.plan !== "PRO" || user.subscriptionStatus !== "ACTIVE") return false
  if (
    user.currentPeriodEnd != null &&
    new Date(user.currentPeriodEnd).getTime() <= Date.now()
  ) {
    return false
  }
  return true
}

/** Human-readable plan label. */
export function planLabel(plan: Plan): string {
  return plan === "PRO" ? "Pro" : "Free"
}

/** Human-readable subscription status label. */
export function subscriptionStatusLabel(status: SubscriptionStatus | null): string {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "PAST_DUE":
      return "Past due"
    case "CANCELED":
      return "Canceled"
    case "EXPIRED":
      return "Expired"
    default:
      return "—"
  }
}

export interface FeatureInfo {
  name: string
  description: string
  proOnly: boolean
}

/** What each plan includes — used by the /upgrade page and docs. */
export const PLAN_FEATURES: FeatureInfo[] = [
  { name: "Dashboard & net worth", description: "Cash flow, savings, wealth overview", proOnly: false },
  { name: "Expense & income tracking", description: "Add, edit, search and categorize transactions", proOnly: false },
  { name: "Monthly budgets", description: "Budgets with rollover, caps, and 50/30/20 templates", proOnly: true },
  { name: "Gold tracking", description: "Buy/sell records with live market prices", proOnly: true },
  { name: "Stock portfolio", description: "Holdings with live prices and dividends", proOnly: true },
  { name: "Recurring automation", description: "Auto-apply recurring income & expenses", proOnly: true },
  { name: "Savings, goals & debts", description: "Bank savings, savings goals, and loan tracking", proOnly: true },
  { name: "Reports", description: "Detailed monthly & yearly reports", proOnly: true },
  { name: "AI monthly analysis", description: "Groq-powered insights into your spending", proOnly: true },
]

/** Route prefixes that require an active Pro plan (or an admin account). */
export const PRO_ONLY_PATH_PREFIXES = [
  "/gold",
  "/stocks",
  "/budgets",
  "/recurring",
  "/reports",
  "/analysis",
  "/savings",
  "/goals",
  "/debts",
]

/** True when a pathname belongs to a Pro-only module. */
export function isProOnlyPath(pathname: string): boolean {
  return PRO_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
