import type { Plan, Role, SubscriptionStatus } from "@prisma/client"

/**
 * Monthly price of the Pro plan in IDR. Used for the admin overview's
 * "potential MRR" figure. Subscriptions are granted manually by admins
 * today (see README), so this is informational — when an online billing
 * gateway is added later, this becomes the checkout amount.
 */
export const PRO_PRICE_IDR = 39_000

/**
 * Monthly price of the Pro+ plan in IDR (the tier above Pro). Used, like
 * PRO_PRICE_IDR, only for the admin overview's "potential MRR" figure —
 * subscriptions are granted manually by admins today. Adjust to match your
 * actual pricing; nothing else depends on the exact number.
 */
export const PRO_PLUS_PRICE_IDR = 79_000

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
 * - Regular users need plan PRO **or PRO_PLUS** with an ACTIVE subscription,
 *   and their current period must not have ended (when a period end is set).
 *   PRO_PLUS is a superset of PRO, so it grants every Pro module too.
 */
export function isProUser(user: EntitlementUser): boolean {
  if (user.suspended) return false
  if (isAdminUser(user)) return true
  if (user.plan !== "PRO" && user.plan !== "PRO_PLUS") return false
  if (user.subscriptionStatus !== "ACTIVE") return false
  if (
    user.currentPeriodEnd != null &&
    new Date(user.currentPeriodEnd).getTime() <= Date.now()
  ) {
    return false
  }
  return true
}

/**
 * True when the user is on the Pro+ tier specifically.
 *
 * Pro+ currently unlocks everything Pro does (see `isProUser`); this helper
 * exists so Pro+-exclusive features added later can gate on it. Admins are NOT
 * auto-upgraded to Pro+ — they already get Pro-level access through
 * `isProUser`, but Pro+ is a paid tier and stays distinct.
 */
export function isProPlusUser(user: EntitlementUser): boolean {
  if (user.suspended) return false
  if (user.plan !== "PRO_PLUS" || user.subscriptionStatus !== "ACTIVE") {
    return false
  }
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
  if (plan === "PRO_PLUS") return "Pro+"
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

/**
 * Features exclusive to Pro+ (the tier above Pro). Pro+ also includes
 * everything in `PLAN_FEATURES`. These are gated server-side with
 * `requireAdminOrProPlusUser` (admins always pass) and, in the UI, by
 * `isProPlusUser` / the session's plan claim.
 */
export const PRO_PLUS_ONLY_FEATURES: FeatureInfo[] = [
  {
    name: "AI budget planner",
    description: "Groq-built budget from last month's actual spending",
    proOnly: false,
  },
  {
    name: "AI goal planner",
    description: "Groq plan to reach a savings goal by your deadline",
    proOnly: false,
  },
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
