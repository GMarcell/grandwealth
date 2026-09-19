import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminUser, isProUser } from "@/lib/subscription"
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

const ACCOUNT_SELECT = {
  id: true,
  role: true,
  plan: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
  suspended: true,
} as const

async function getAccount(): Promise<AccountAccess | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: ACCOUNT_SELECT,
  })
  if (!user) return null

  return {
    id: user.id,
    role: user.role,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    suspended: user.suspended,
  }
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
