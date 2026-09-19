import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminAccess } from "@/lib/api-access"
import { PRO_PRICE_IDR } from "@/lib/subscription"
import { expireLapsedTrials } from "@/lib/trial"

/**
 * Admin-only aggregate stats for the admin dashboard.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const access = await requireAdminAccess(session.user.id)
  if (access instanceof NextResponse) {
    return access
  }

  try {
    // End lapsed trials first so counts & MRR don't include them.
    await expireLapsedTrials()

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [
      totalUsers,
      freeUsers,
      proUsers,
      // Paying Pro subscribers (manual/admin grants) — what MRR is based on.
      proActive,
      // Active Pro access from an admin-approved trial.
      onTrial,
      proLapsed,
      suspended,
      newThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: "FREE" } }),
      prisma.user.count({ where: { plan: "PRO" } }),
      prisma.user.count({
        where: { plan: "PRO", subscriptionStatus: "ACTIVE", isTrial: false },
      }),
      prisma.user.count({
        where: { plan: "PRO", subscriptionStatus: "ACTIVE", isTrial: true },
      }),
      prisma.user.count({
        where: { plan: "PRO", subscriptionStatus: { not: "ACTIVE" } },
      }),
      prisma.user.count({ where: { suspended: true } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    ])

    return NextResponse.json({
      totalUsers,
      freeUsers,
      proUsers,
      proActive,
      onTrial,
      proLapsed,
      suspended,
      newThisMonth,
      potentialMrr: proActive * PRO_PRICE_IDR,
      pricePerMonth: PRO_PRICE_IDR,
    })
  } catch (error) {
    console.error("Admin overview error:", error)
    return NextResponse.json(
      { error: "Failed to load admin overview" },
      { status: 500 }
    )
  }
}
