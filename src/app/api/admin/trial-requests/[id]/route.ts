import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminAccess } from "@/lib/api-access"
import { adminTrialRequestDecisionSchema, safeParseBody } from "@/lib/validation"
import { proTrialPeriodEnd } from "@/lib/subscription"
import { notifyUserOfApprovedTrial } from "@/lib/trial-request"

/**
 * PATCH /api/admin/trial-requests/[id]
 * Body: { status: "APPROVED" | "DECLINED", note? }
 *
 * Decides a pending trial request. Approving grants PRO for `PRO_TRIAL_DAYS`
 * (30) days — the account drops back to FREE automatically at the period end
 * via `expireLapsedTrials`, so nothing has to be scheduled here.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const access = await requireAdminAccess(session.user.id)
  if (access instanceof NextResponse) {
    return access
  }

  const { id } = await params

  const parsed = await safeParseBody(req, adminTrialRequestDecisionSchema)
  if ("error" in parsed) return parsed.error

  const { status, note } = parsed.data

  try {
    const request = await prisma.trialRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        user: { select: { id: true, email: true, suspended: true } },
      },
    })

    if (!request) {
      return NextResponse.json(
        { error: "Trial request not found" },
        { status: 404 }
      )
    }

    // Decided requests are immutable — avoids a double grant.
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: `This request was already ${request.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    const decidedAt = new Date()
    const trialEndsAt = status === "APPROVED" ? proTrialPeriodEnd(decidedAt) : null

    await prisma.$transaction(async (tx) => {
      if (trialEndsAt) {
        // Grant the trial. `isTrial: true` keeps it out of MRR and lets
        // `expireLapsedTrials` sweep the account back to FREE afterwards.
        await tx.user.update({
          where: { id: request.user.id },
          data: {
            plan: "PRO",
            subscriptionStatus: "ACTIVE",
            currentPeriodEnd: trialEndsAt,
            isTrial: true,
          },
        })
      }

      await tx.trialRequest.update({
        where: { id: request.id },
        data: {
          status,
          decisionNote: note || null,
          decidedById: session.user!.id,
          decidedAt,
        },
      })
    })

    if (trialEndsAt) {
      // Best-effort: tell the user their trial is running.
      try {
        await notifyUserOfApprovedTrial({
          userEmail: request.user.email,
          trialEndsAt,
        })
      } catch (error) {
        console.error("Trial approval notification error:", error)
      }
    }

    return NextResponse.json({
      success: true,
      status,
      decidedAt: decidedAt.toISOString(),
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("Admin decide trial request error:", error)
    return NextResponse.json(
      { error: "Failed to update trial request" },
      { status: 500 }
    )
  }
}
