import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdminUser, isProUser } from "@/lib/subscription"
import { getAccessRecord } from "@/lib/account-access"
import type { Plan, Role, SubscriptionStatus } from "@prisma/client"

/**
 * Server-component guards (pages & layouts).
 *
 * Each guard runs `auth()` and then reads the account's current state from
 * the database, so plan/role/suspension changes made by an admin take
 * effect immediately (the JWT only carries the state from sign-in time).
 */

export interface AccountAccess {
  id: string
  role: Role
  plan: Plan
  subscriptionStatus: SubscriptionStatus | null
  currentPeriodEnd: Date | null
  suspended: boolean
}

async function getAccount(): Promise<AccountAccess | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  // Shares the per-request cached access record with `auth()`, so a page
  // guard does not re-read the same row.
  const account = await getAccessRecord(session.user.id)
  if (!account) return null

  return { id: session.user.id, ...account }
}

function loginUrl(callbackUrl?: string): string {
  return callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login"
}

/**
 * Requires a signed-in, non-suspended account. Redirects to /login when
 * unauthenticated and /suspended when the account is suspended or deleted.
 */
export async function requireAccount(callbackUrl?: string): Promise<AccountAccess> {
  const account = await getAccount()
  if (!account) {
    redirect(loginUrl(callbackUrl))
  }
  if (account.suspended) {
    redirect("/suspended")
  }
  return account
}

/**
 * Requires an account entitled to Pro features. Redirects to /upgrade when
 * the user is on the Free plan (or their subscription lapsed).
 */
export async function requirePro(callbackUrl?: string): Promise<AccountAccess> {
  const account = await requireAccount(callbackUrl)
  if (!isProUser(account)) {
    redirect("/upgrade")
  }
  return account
}

/**
 * Requires an admin account. Redirects non-admins to /dashboard.
 */
export async function requireAdmin(): Promise<AccountAccess> {
  const account = await requireAccount()
  if (!isAdminUser(account)) {
    redirect("/dashboard")
  }
  return account
}
