import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { createBudgetSchema, safeParseBody } from "@/lib/validation"
import { rateLimit } from "@/lib/rate-limit"
import { shortCircuitIdempotent, recordIdempotencyKey } from "@/lib/idempotency"

export async function GET() {
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

  const budgets = await prisma.budget.findMany({
    where: { userId: userId },
    orderBy: [{ month: "desc" }, { categoryName: "asc" }],
  })

  return NextResponse.json(budgets)
}

export async function POST(req: Request) {
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

  const limiter = await rateLimit(`budgets:${userId}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    // Replayed offline write: the original already applied, so skip it.
    const replayed = await shortCircuitIdempotent(req, userId)
    if (replayed) return replayed

    const parsed = await safeParseBody(req, createBudgetSchema)
    if ("error" in parsed) return parsed.error

    const { categoryName, amount, month, rolloverCap, canReduce } = parsed.data

    // Check if budget already exists for this category/month
    const existing = await prisma.budget.findUnique({
      where: { categoryName_month_userId: { categoryName, month, userId: userId } },
    })

    if (existing) {
      const updated = await prisma.budget.update({
        where: { id: existing.id },
        data: {
          amount,
          ...(rolloverCap !== undefined ? { rolloverCap } : {}),
          ...(canReduce !== undefined ? { canReduce } : {}),
        },
      })
      await recordIdempotencyKey(req, userId)
      return NextResponse.json({
        id: updated.id,
        categoryName: updated.categoryName,
        amount: updated.amount,
        month: updated.month,
        rolloverCap: updated.rolloverCap,
        canReduce: updated.canReduce,
      })
    }

    const budget = await prisma.budget.create({
      data: {
        categoryName,
        amount,
        month,
        rolloverCap: rolloverCap ?? null,
        canReduce: canReduce ?? true,
        userId: userId,
      },
    })

    await recordIdempotencyKey(req, userId)

    return NextResponse.json(
      {
        id: budget.id,
        categoryName: budget.categoryName,
        amount: budget.amount,
        month: budget.month,
        rolloverCap: budget.rolloverCap,
        canReduce: budget.canReduce,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create budget error:", error)
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 }
    )
  }
}
