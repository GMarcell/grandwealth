import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function POST(req: Request) {
  // Rate limit: 5 registration attempts per 10 minutes per IP
  const limiter = rateLimit(`register:${getRateLimitKey(req)}`, {
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

    await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
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
