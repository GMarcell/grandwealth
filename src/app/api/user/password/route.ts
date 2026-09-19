import { NextResponse } from "next/server"
import { compare, hash } from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { changePasswordSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

/**
 * PATCH /api/user/password
 * Body: { currentPassword?, newPassword }
 *
 * Lets a signed-in user set their own password. The current password must
 * match — except for accounts that don't have one yet (created through an
 * OAuth provider), where this acts as a first-time "set a password".
 */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 5 password changes per 15 minutes per IP — the current-password
  // check would otherwise be a place to guess credentials.
  const limiter = await rateLimit(`change-password:${getRateLimitKey(req)}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
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

  const parsed = await safeParseBody(req, changePasswordSchema)
  if ("error" in parsed) return parsed.error

  const { currentPassword, newPassword } = parsed.data

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.password) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 }
        )
      }

      const isValid = await compare(currentPassword, user.password)
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        )
      }
    }

    const passwordHash = await hash(newPassword, 12)

    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: passwordHash },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Change password error:", error)
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    )
  }
}
