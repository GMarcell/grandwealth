import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdminUser, isProUser } from "@/lib/subscription"

/** Fields needed to decide request-time entitlements (no full-row fetch). */
const ACCESS_SELECT = {
  role: true,
  plan: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
  suspended: true,
} as const

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
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: ACCESS_SELECT,
  })
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
export async function requireAdminAccess(
  sessionUserId: string
): Promise<string | NextResponse> {
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: ACCESS_SELECT,
  })
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
