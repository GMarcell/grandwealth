import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateGoalSchema, contributeGoalSchema, safeParseBody } from "@/lib/validation"

async function getOwnedGoal(id: string, userId: string) {
  const goal = await prisma.savingsGoal.findUnique({ where: { id } })
  if (!goal || goal.userId !== userId) return null
  return goal
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await getOwnedGoal(id, session.user.id)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateGoalSchema)
    if ("error" in parsed) return parsed.error

    const { name, targetAmount, savedAmount, targetDate, color } = parsed.data
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (targetAmount !== undefined) data.targetAmount = targetAmount
    if (savedAmount !== undefined) data.savedAmount = savedAmount
    if (color !== undefined) data.color = color
    if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null

    const goal = await prisma.savingsGoal.update({ where: { id }, data })

    return NextResponse.json({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      targetDate: goal.targetDate?.toISOString() ?? null,
      color: goal.color,
      createdAt: goal.createdAt.toISOString(),
    })
  } catch (error) {
    console.error("Update goal error:", error)
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    )
  }
}

/**
 * Add to / deduct from a goal's saved amount.
 * Body: { amount: number } — positive adds, negative withdraws.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await getOwnedGoal(id, session.user.id)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, contributeGoalSchema)
    if ("error" in parsed) return parsed.error

    const { amount } = parsed.data
    const newSaved = Math.max(0, existing.savedAmount + amount)

    const goal = await prisma.savingsGoal.update({
      where: { id },
      data: { savedAmount: newSaved },
    })

    return NextResponse.json({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      targetDate: goal.targetDate?.toISOString() ?? null,
      color: goal.color,
    })
  } catch (error) {
    console.error("Contribute to goal error:", error)
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await getOwnedGoal(id, session.user.id)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.savingsGoal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete goal error:", error)
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    )
  }
}
