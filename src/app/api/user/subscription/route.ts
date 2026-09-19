import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminUser, isProUser } from "@/lib/subscription"
import { expireLapsedTrials } from "@/lib/trial"

/**
 * Returns the signed-in user's LIVE subscription state from the database.
 * The session JWT carries a snapshot from sign-in time; this endpoint is
 * authoritative and reflects admin changes immediately (used by Settings
 * and any plan-aware UI).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Self-heal: if this account's trial just ended, downgrade it before
    // reporting state so the UI never shows a lapsed trial as active.
    await expireLapsedTrials()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        isTrial: true,
        suspended: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
      role: user.role,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
      isTrial: user.isTrial,
      suspended: user.suspended,
      isPro: isProUser(user),
      isAdmin: isAdminUser(user),
    })
  } catch (error) {
    console.error("Fetch subscription error:", error)
    return NextResponse.json(
      { error: "Failed to load subscription" },
      { status: 500 }
    )
  }
}
