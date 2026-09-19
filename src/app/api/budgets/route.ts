import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { createBudgetSchema, safeParseBody } from "@/lib/validation"
import { rateLimit } from "@/lib/rate-limit"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const budgets = await prisma.budget.findMany({
    where: { userId: session.user.id },
    orderBy: [{ month: "desc" }, { categoryName: "asc" }],
  })

  return NextResponse.json(budgets)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const limiter = await rateLimit(`budgets:${session.user.id}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createBudgetSchema)
    if ("error" in parsed) return parsed.error

    const { categoryName, amount, month, rolloverCap } = parsed.data

    // Check if budget already exists for this category/month
    const existing = await prisma.budget.findUnique({
      where: { categoryName_month_userId: { categoryName, month, userId: session.user.id } },
    })

    if (existing) {
      const updated = await prisma.budget.update({
        where: { id: existing.id },
        data: {
          amount,
          ...(rolloverCap !== undefined ? { rolloverCap } : {}),
        },
      })
      return NextResponse.json({
        id: updated.id,
        categoryName: updated.categoryName,
        amount: updated.amount,
        month: updated.month,
        rolloverCap: updated.rolloverCap,
      })
    }

    const budget = await prisma.budget.create({
      data: {
        categoryName,
        amount,
        month,
        rolloverCap: rolloverCap ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: budget.id,
        categoryName: budget.categoryName,
        amount: budget.amount,
        month: budget.month,
        rolloverCap: budget.rolloverCap,
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
