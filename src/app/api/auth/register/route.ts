import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { isBootstrapAdminEmail } from "@/lib/admin-bootstrap"
import { PRO_TRIAL_DAYS } from "@/lib/subscription"

export async function POST(req: Request) {
  // Rate limit: 5 registration attempts per 10 minutes per IP
  const limiter = await rateLimit(`register:${getRateLimitKey(req)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limiter.resetTime - Date.now()) / 1000)) } }
    )
  }

  try {
    const parsed = await safeParseBody(req, registerSchema)
    if ("error" in parsed) return parsed.error

    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    const hashedPassword = await hash(password, 12)

    // Emails listed in ADMIN_EMAILS register as admins (bootstrap). Everyone
    // else gets the USER role plus a free 14-day Pro trial so they can
    // experience the paid modules before subscribing (admin-managed).
    const role = isBootstrapAdminEmail(email) ? "ADMIN" : undefined

    await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
        ...(role
          ? { role }
          : {
              plan: "PRO",
              subscriptionStatus: "ACTIVE",
              currentPeriodEnd: new Date(
                Date.now() + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000
              ),
              isTrial: true,
            }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
