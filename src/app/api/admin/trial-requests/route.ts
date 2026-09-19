import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminAccess } from "@/lib/api-access"
import { adminTrialRequestsQuerySchema } from "@/lib/validation"
import { buildPagination } from "@/lib/utils"
import { expireLapsedTrials } from "@/lib/trial"
import type { Prisma } from "@prisma/client"

/**
 * GET /api/admin/trial-requests
 *
 * Admin-only listing of Pro trial requests. Unresolved (PENDING) requests come
 * first, then the most recent decisions. Drives the admin panel's trial
 * requests card and the sidebar badge.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const access = await requireAdminAccess(session.user.id)
  if (access instanceof NextResponse) {
    return access
  }

  const url = new URL(req.url)
  const parsed = adminTrialRequestsQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 }
    )
  }

  const { status } = parsed.data
  const page = parsed.data.page ?? 1
  const pageSize = parsed.data.pageSize ?? 20

  try {
    // End lapsed trials first so the users in the list show truthful state.
    await expireLapsedTrials()

    const where: Prisma.TrialRequestWhereInput = status ? { status } : {}

    const [total, requests] = await Promise.all([
      prisma.trialRequest.count({ where }),
      prisma.trialRequest.findMany({
        where,
        // PENDING is declared first in the enum, so ascending status puts
        // unresolved requests at the top; newest first within each group.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          message: true,
          decisionNote: true,
          decidedById: true,
          decidedAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              plan: true,
              subscriptionStatus: true,
              currentPeriodEnd: true,
              isTrial: true,
              suspended: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({
      data: requests.map((request) => ({
        ...request,
        createdAt: request.createdAt.toISOString(),
        decidedAt: request.decidedAt?.toISOString() ?? null,
        user: {
          ...request.user,
          currentPeriodEnd: request.user.currentPeriodEnd?.toISOString() ?? null,
        },
      })),
      pagination: buildPagination(total, { page, pageSize }),
    })
  } catch (error) {
    console.error("Admin trial requests listing error:", error)
    return NextResponse.json(
      { error: "Failed to load trial requests" },
      { status: 500 }
    )
  }
}
