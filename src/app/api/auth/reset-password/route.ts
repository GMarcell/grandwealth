import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { resetPasswordSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 *
 * Validates the one-time reset token, updates the user's password, and
 * consumes the token.
 */
export async function POST(req: Request) {
  const limiter = await rateLimit(`reset-password:${getRateLimitKey(req)}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const parsed = await safeParseBody(req, resetPasswordSchema)
  if ("error" in parsed) return parsed.error

  const { token, password } = parsed.data

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
  })

  if (!user || !user.password) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    )
  }

  const passwordHash = await hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: passwordHash },
  })

  // Consume the token so it can't be reused.
  await prisma.verificationToken.delete({ where: { token } })

  return NextResponse.json({ message: "Password updated. You can now sign in." })
}
