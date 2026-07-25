import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

/**
 * DELETE /api/user/account
 *
 * Permanently deletes the authenticated user's account and all associated data.
 * The Prisma schema uses `onDelete: Cascade` on all user relations, so all
 * transactions, categories, budgets, gold deposits, stocks, recurring
 * transactions, bank savings, sessions, and accounts are removed automatically.
 *
 * This action is irreversible.
 */
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 2 account deletion attempts per 10 minutes per IP
  const limiter = await rateLimit(`delete-account:${getRateLimitKey(req)}`, {
    limit: 2,
    windowMs: 10 * 60 * 1000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((limiter.resetTime - Date.now()) / 1000)) },
      }
    )
  }

  try {
    // Double-check the user exists
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Delete the user — all related records are cascade-deleted by Prisma
    await prisma.user.delete({
      where: { id: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete account error:", error)
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    )
  }
}
