import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  try {
    const { categoryName, amount, month, rolloverEnabled, rolloverCap } = await req.json()

    if (!categoryName || amount == null || !month) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Budget amount must be greater than 0" },
        { status: 400 }
      )
    }

    // Check if budget already exists for this category/month
    const existing = await prisma.budget.findUnique({
      where: { categoryName_month_userId: { categoryName, month, userId: session.user.id } },
    })

    if (existing) {
      // Update instead of creating
      const updateData: any = { amount }
      if (rolloverEnabled !== undefined) updateData.rolloverEnabled = rolloverEnabled
      if (rolloverCap !== undefined) updateData.rolloverCap = rolloverCap

      const updated = await prisma.budget.update({
        where: { id: existing.id },
        data: updateData,
      })
      return NextResponse.json(updated)
    }

    const budget = await prisma.budget.create({
      data: {
        categoryName,
        amount,
        month,
        rolloverEnabled: rolloverEnabled ?? true,
        rolloverCap: rolloverCap ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(budget, { status: 201 })
  } catch (error) {
    console.error("Create budget error:", error)
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 }
    )
  }
}
