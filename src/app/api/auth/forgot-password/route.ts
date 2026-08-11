import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { forgotPasswordSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { sendEmail } from "@/lib/email"

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always responds 200 to avoid leaking whether an account exists. When the
 * account exists, a one-time reset token is stored and emailed to the user.
 */
export async function POST(req: Request) {
  const limiter = await rateLimit(`forgot-password:${getRateLimitKey(req)}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const parsed = await safeParseBody(req, forgotPasswordSchema)
  if ("error" in parsed) return parsed.error

  const { email } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })

  // Always resolve successfully; only email when the account exists.
  if (user?.password) {
    const token = randomBytes(32).toString("hex")

    // Replace any previous tokens for this account.
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    })

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })

    const origin =
      process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      new URL(req.url).origin

    const resetUrl = `${origin}/reset-password?token=${token}`

    await sendEmail({
      to: email,
      subject: "Reset your GrandWealth password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#111">Reset your GrandWealth password</h2>
          <p style="color:#333">Hi${user.name ? ` ${user.name}` : ""},</p>
          <p style="color:#333">
            We received a request to reset your password. Click the button below
            to choose a new one. This link expires in 1 hour.
          </p>
          <p style="margin: 24px 0">
            <a href="${resetUrl}"
               style="background:#6366f1; color:#fff; padding:12px 24px;
                      border-radius:8px; text-decoration:none; font-weight:600;">
              Reset password
            </a>
          </p>
          <p style="color:#666; font-size:12px">
            If you didn't request this, you can safely ignore this email.
          </p>
          <p style="color:#999; font-size:12px">
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
      `,
    })
  }

  return NextResponse.json({
    message:
      "If an account exists for that email, a password reset link has been sent.",
  })
}
