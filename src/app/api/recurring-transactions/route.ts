import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { createRecurringSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const limiter = await rateLimit(`recurring-get:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const recurring = await prisma.recurringTransaction.findMany({
    where: { userId: session.user.id },
    include: { savingsGoal: { select: { name: true } } },
    orderBy: { nextDate: "asc" },
  })

  return NextResponse.json(
    recurring.map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      amount: r.amount,
      description: r.description,
      frequency: r.frequency,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      nextDate: r.nextDate.toISOString(),
      active: r.active,
      savingsGoalId: r.savingsGoalId,
      savingsGoalName: r.savingsGoal?.name ?? null,
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const limiter = await rateLimit(`recurring:${session.user.id}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createRecurringSchema)
    if ("error" in parsed) return parsed.error

    const { type, category, amount, description, frequency, startDate, endDate, nextDate, savingsGoalId } = parsed.data

    // Verify the linked goal belongs to the user when one is provided.
    if (savingsGoalId) {
      const goal = await prisma.savingsGoal.findUnique({ where: { id: savingsGoalId } })
      if (!goal || goal.userId !== session.user.id) {
        return NextResponse.json({ error: "Savings goal not found" }, { status: 404 })
      }
    }

    const recurring = await prisma.recurringTransaction.create({
      data: {
        type,
        category,
        amount,
        description,
        frequency,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        nextDate: new Date(nextDate),
        savingsGoalId: savingsGoalId ?? null,
        userId: session.user.id,
      },
      include: { savingsGoal: { select: { name: true } } },
    })

    return NextResponse.json(
      {
        id: recurring.id,
        type: recurring.type,
        category: recurring.category,
        amount: recurring.amount,
        description: recurring.description,
        frequency: recurring.frequency,
        startDate: recurring.startDate.toISOString(),
        endDate: recurring.endDate?.toISOString() ?? null,
        nextDate: recurring.nextDate.toISOString(),
        active: recurring.active,
        savingsGoalId: recurring.savingsGoalId,
        savingsGoalName: recurring.savingsGoal?.name ?? null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create recurring error:", error)
    return NextResponse.json(
      { error: "Failed to create recurring transaction" },
      { status: 500 }
    )
  }
}
