import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminAccess } from "@/lib/api-access"
import { DEFAULT_PASSWORD } from "@/lib/password"

/**
 * POST /api/admin/users/[id]/reset-password
 *
 * Resets a user's password back to the shared default so an administrator can
 * hand a locked-out account back to its owner. The default is returned in the
 * response so the admin can pass it on; the user is expected to change it from
 * Settings afterwards.
 */
export async function POST(
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
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const passwordHash = await hash(DEFAULT_PASSWORD, 12)

    await prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    })

    return NextResponse.json({ success: true, defaultPassword: DEFAULT_PASSWORD })
  } catch (error) {
    console.error("Admin reset password error:", error)
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    )
  }
}
