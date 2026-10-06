import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminUser } from "@/lib/api-access"
import { PRO_PRICE_IDR, PRO_PLUS_PRICE_IDR } from "@/lib/subscription"
import { expireLapsedTrials } from "@/lib/trial"

/**
 * Admin-only aggregate stats for the admin dashboard.
 */
export async function GET() {
  const userId = await requireAdminUser()
  if (userId instanceof NextResponse) return userId

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
      proPlusUsers,
      // Paying subscribers (manual/admin grants) — what MRR is based on.
      proActive,
      proPlusActive,
      // Active paid access from an admin-approved trial.
      onTrial,
      proLapsed,
      suspended,
      newThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: "FREE" } }),
      prisma.user.count({ where: { plan: "PRO" } }),
      prisma.user.count({ where: { plan: "PRO_PLUS" } }),
      prisma.user.count({
        where: { plan: "PRO", subscriptionStatus: "ACTIVE", isTrial: false },
      }),
      prisma.user.count({
        where: { plan: "PRO_PLUS", subscriptionStatus: "ACTIVE", isTrial: false },
      }),
      prisma.user.count({
        where: {
          plan: { in: ["PRO", "PRO_PLUS"] },
          subscriptionStatus: "ACTIVE",
          isTrial: true,
        },
      }),
      prisma.user.count({
        where: {
          plan: { in: ["PRO", "PRO_PLUS"] },
          subscriptionStatus: { not: "ACTIVE" },
        },
      }),
      prisma.user.count({ where: { suspended: true } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    ])

    return NextResponse.json({
      totalUsers,
      freeUsers,
      proUsers,
      proPlusUsers,
      proActive,
      proPlusActive,
      onTrial,
      proLapsed,
      suspended,
      newThisMonth,
      potentialMrr: proActive * PRO_PRICE_IDR + proPlusActive * PRO_PLUS_PRICE_IDR,
      pricePerMonth: PRO_PRICE_IDR,
      proPlusPricePerMonth: PRO_PLUS_PRICE_IDR,
    })
  } catch (error) {
    console.error("Admin overview error:", error)
    return NextResponse.json(
      { error: "Failed to load admin overview" },
      { status: 500 }
    )
  }
}
