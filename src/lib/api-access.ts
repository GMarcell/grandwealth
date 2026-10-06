import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminUser, isProPlusUser, isProUser } from "@/lib/subscription"
import { getAccessRecord } from "@/lib/account-access"

/**
 * Authorize access to a Pro-only API route.
 *
 * @param sessionUserId The authenticated user's id (from `auth()`).
 * @returns The user id when access is allowed, otherwise a `NextResponse`
 *          (401 Unauthorized / 403 Forbidden) that the caller should return.
 */
export async function requireProAccess(
  sessionUserId: string
): Promise<string | NextResponse> {
  const user = await getAccessRecord(sessionUserId)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.suspended) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 })
  }
  if (!isProUser(user)) {
    return NextResponse.json(
      { error: "Pro subscription required" },
      { status: 403 }
    )
  }
  return sessionUserId
}

/**
 * Authorize access to an admin-only API route.
 *
 * @param sessionUserId The authenticated user's id (from `auth()`).
 * @returns The user id when access is allowed, otherwise a `NextResponse`
 *          (401 Unauthorized / 403 Forbidden) that the caller should return.
 */
/**
 * Require a signed-in, non-suspended account.
 *
 * @returns The user id, or a 401 `NextResponse` the caller should return.
 */
export async function requireUser(): Promise<string | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return session.user.id
}

/**
 * Require a signed-in account entitled to Pro features. Combines the session
 * check with `requireProAccess` so a guarded route needs a single guard call.
 *
 * @returns The user id, or the 401/403 `NextResponse` the caller should return.
 */
export async function requireProUser(): Promise<string | NextResponse> {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId
  return requireProAccess(userId)
}

/**
 * Authorize access to an Admin **or** Pro+ route.
 *
 * Used by the Groq AI features, which are Pro+-exclusive: a Pro+ subscriber
 * can use them, and administrators always can (useful for testing/support).
 * Regular Pro users are refused.
 *
 * @param sessionUserId The authenticated user's id (from `auth()`).
 * @returns The user id when access is allowed, otherwise a `NextResponse`
 *          (401 Unauthorized / 403 Forbidden) that the caller should return.
 */
export async function requireAdminOrProPlusAccess(
  sessionUserId: string
): Promise<string | NextResponse> {
  const user = await getAccessRecord(sessionUserId)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.suspended) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 })
  }
  if (isAdminUser(user) || isProPlusUser(user)) {
    return sessionUserId
  }
  return NextResponse.json(
    { error: "Pro+ subscription required" },
    { status: 403 }
  )
}

/**
 * Require a signed-in account entitled to an Admin-or-Pro+ feature. Combines
 * the session check with `requireAdminOrProPlusAccess` so a guarded route
 * needs a single guard call.
 *
 * @returns The user id, or the 401/403 `NextResponse` the caller should return.
 */
export async function requireAdminOrProPlusUser(): Promise<string | NextResponse> {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId
  return requireAdminOrProPlusAccess(userId)
}

/**
 * Require a signed-in administrator. Combines the session check with
 * `requireAdminAccess` so a guarded route needs a single guard call.
 *
 * @returns The user id, or the 401/403 `NextResponse` the caller should return.
 */
export async function requireAdminUser(): Promise<string | NextResponse> {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId
  return requireAdminAccess(userId)
}

export async function requireAdminAccess(
  sessionUserId: string
): Promise<string | NextResponse> {
  const user = await getAccessRecord(sessionUserId)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (user.suspended || !isAdminUser(user)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    )
  }
  return sessionUserId
}
