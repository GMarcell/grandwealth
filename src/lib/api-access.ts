import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminUser, isProUser } from "@/lib/subscription"
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
