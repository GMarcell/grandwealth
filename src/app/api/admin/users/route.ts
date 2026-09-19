import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminAccess } from "@/lib/api-access"
import { adminUsersQuerySchema } from "@/lib/validation"
import { buildPagination } from "@/lib/utils"
import { expireLapsedTrials } from "@/lib/trial"
import type { Prisma } from "@prisma/client"

/**
 * Admin-only user listing. Supports search (name/email), plan/role/status
 * filters, suspended filter, and pagination.
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
  const parsed = adminUsersQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    plan: url.searchParams.get("plan") ?? undefined,
    subscriptionStatus: url.searchParams.get("status") ?? undefined,
    suspended: url.searchParams.get("suspended") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 }
    )
  }

  const { search, role, plan, subscriptionStatus, suspended } = parsed.data
  const page = parsed.data.page ?? 1
  const pageSize = parsed.data.pageSize ?? 20

  try {
    // End lapsed trials so the list shows truthful plan/status state.
    await expireLapsedTrials()

    const where: Prisma.UserWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(role ? { role } : {}),
      ...(plan ? { plan } : {}),
      ...(subscriptionStatus ? { subscriptionStatus } : {}),
      ...(suspended !== undefined
        ? { suspended: suspended === "true" }
        : {}),
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          plan: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          isTrial: true,
          suspended: true,
          createdAt: true,
          _count: { select: { transactions: true } },
        },
      }),
    ])

    return NextResponse.json({
      data: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        currentPeriodEnd: u.currentPeriodEnd?.toISOString() ?? null,
      })),
      pagination: buildPagination(total, { page, pageSize }),
    })
  } catch (error) {
    console.error("Admin users listing error:", error)
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    )
  }
}
