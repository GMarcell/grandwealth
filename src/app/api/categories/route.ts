import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCategorySchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`categories-get:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const categories = await prisma.category.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`categories:${getRateLimitKey(req)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createCategorySchema)
    if ("error" in parsed) return parsed.error

    const { name, type, color, ruleType } = parsed.data

    const existing = await prisma.category.findUnique({
      where: { name_userId: { name, userId: session.user.id } },
    })

    if (existing) {
      return NextResponse.json(
        { error: "You already have a category with that name" },
        { status: 409 }
      )
    }

    const category = await prisma.category.create({
      data: {
        name,
        type,
        color: color ?? "#6366f1",
        ruleType: ruleType ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("Create category error:", error)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}
