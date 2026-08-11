import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createGoalSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const goals = await prisma.savingsGoal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(
    goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      targetDate: g.targetDate?.toISOString() ?? null,
      color: g.color,
      createdAt: g.createdAt.toISOString(),
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = await rateLimit(`goals:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createGoalSchema)
    if ("error" in parsed) return parsed.error

    const { name, targetAmount, savedAmount, targetDate, color } = parsed.data

    const goal = await prisma.savingsGoal.create({
      data: {
        name,
        targetAmount,
        savedAmount: savedAmount ?? 0,
        targetDate: targetDate ? new Date(targetDate) : null,
        color: color ?? "#6366f1",
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount,
        targetDate: goal.targetDate?.toISOString() ?? null,
        color: goal.color,
        createdAt: goal.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create goal error:", error)
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    )
  }
}
