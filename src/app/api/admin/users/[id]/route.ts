import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminAccess } from "@/lib/api-access"
import { adminUpdateUserSchema, safeParseBody } from "@/lib/validation"

const USER_SELECT = {
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
} as const

function serialize(user: {
  id: string
  name: string | null
  email: string
  role: string
  plan: string
  subscriptionStatus: string | null
  currentPeriodEnd: Date | null
  isTrial: boolean
  suspended: boolean
  createdAt: Date
}) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
  }
}

/** Block destructive actions against the last remaining admin. */
async function ensureNotLastAdmin(targetId: string): Promise<string | null> {
  const otherAdmins = await prisma.user.count({
    where: { role: "ADMIN", id: { not: targetId } },
  })
  return otherAdmins > 0 ? null : "Cannot demote or remove the last administrator"
}

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
  const actingUserId = session.user.id

  try {
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, adminUpdateUserSchema)
    if ("error" in parsed) return parsed.error

    const { role, plan, subscriptionStatus, currentPeriodEnd, suspended, isTrial } = parsed.data

    // Admins can't lock themselves out: no self-demotion or self-suspension.
    if (id === actingUserId) {
      if (role === "USER") {
        return NextResponse.json(
          { error: "You cannot demote your own account" },
          { status: 400 }
        )
      }
      if (suspended === true) {
        return NextResponse.json(
          { error: "You cannot suspend your own account" },
          { status: 400 }
        )
      }
    }

    // Protect the last admin from demotion.
    if (role === "USER" && target.role === "ADMIN") {
      const error = await ensureNotLastAdmin(id)
      if (error) {
        return NextResponse.json({ error }, { status: 400 })
      }
    }

    const data: Record<string, unknown> = {}
    if (role !== undefined) data.role = role
    if (suspended !== undefined) data.suspended = suspended

    if (plan !== undefined || subscriptionStatus !== undefined || currentPeriodEnd !== undefined) {
      if (plan === "FREE") {
        // Downgrade clears subscription state entirely (single source of truth).
        data.plan = "FREE"
        data.subscriptionStatus = null
        data.currentPeriodEnd = null
        data.isTrial = false
      } else {
        if (plan === "PRO") data.plan = "PRO"
        if (subscriptionStatus !== undefined) data.subscriptionStatus = subscriptionStatus

        if (currentPeriodEnd !== undefined) {
          if (currentPeriodEnd === null || currentPeriodEnd.trim() === "") {
            data.currentPeriodEnd = null
          } else {
            const parsedDate = new Date(currentPeriodEnd)
            if (Number.isNaN(parsedDate.getTime())) {
              return NextResponse.json(
                { error: "Invalid period end date" },
                { status: 400 }
              )
            }
            data.currentPeriodEnd = parsedDate
          }
        }

        // Granting PRO without an explicit status means: activate now.
        if (data.plan === "PRO" && data.subscriptionStatus === undefined) {
          data.subscriptionStatus = "ACTIVE"
        }

        // A manual admin grant is a paid subscription by default. The admin
        // can explicitly pass isTrial: true to grant (or extend) a free trial
        // instead — trials are excluded from MRR.
        data.isTrial = isTrial ?? false
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    })

    return NextResponse.json(serialize(updated))
  } catch (error) {
    console.error("Admin update user error:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
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

  try {
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (id === session.user?.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account here" },
        { status: 400 }
      )
    }

    if (target.role === "ADMIN") {
      const error = await ensureNotLastAdmin(id)
      if (error) {
        return NextResponse.json({ error }, { status: 400 })
      }
    }

    // Deleting the user cascades to all their data (schema onDelete: Cascade).
    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin delete user error:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
