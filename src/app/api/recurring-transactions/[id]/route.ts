import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { updateRecurringSchema, safeParseBody } from "@/lib/validation"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  try {
    const { id } = await params
    const existing = await prisma.recurringTransaction.findUnique({
      where: { id },
    })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateRecurringSchema)
    if ("error" in parsed) return parsed.error

    const { type, category, amount, description, frequency, startDate, endDate, nextDate, active, savingsGoalId } = parsed.data
    const updateData: Record<string, unknown> = {}

    if (type !== undefined) updateData.type = type
    if (category !== undefined) updateData.category = category
    if (amount !== undefined) updateData.amount = amount
    if (description !== undefined) updateData.description = description
    if (frequency !== undefined) updateData.frequency = frequency
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (nextDate !== undefined) updateData.nextDate = new Date(nextDate)
    if (active !== undefined) updateData.active = active
    if (savingsGoalId !== undefined) {
      // When (re)linking, verify the goal belongs to the user.
      if (savingsGoalId) {
        const goal = await prisma.savingsGoal.findUnique({ where: { id: savingsGoalId } })
        if (!goal || goal.userId !== session.user.id) {
          return NextResponse.json({ error: "Savings goal not found" }, { status: 404 })
        }
      }
      updateData.savingsGoalId = savingsGoalId ?? null
    }

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: updateData,
      include: { savingsGoal: { select: { name: true } } },
    })

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      category: updated.category,
      amount: updated.amount,
      description: updated.description,
      frequency: updated.frequency,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate?.toISOString() ?? null,
      nextDate: updated.nextDate.toISOString(),
      active: updated.active,
      savingsGoalId: updated.savingsGoalId,
      savingsGoalName: updated.savingsGoal?.name ?? null,
    })
  } catch (error) {
    console.error("Update recurring error:", error)
    return NextResponse.json(
      { error: "Failed to update recurring transaction" },
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

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  try {
    const { id } = await params
    const existing = await prisma.recurringTransaction.findUnique({
      where: { id },
    })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.recurringTransaction.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete recurring error:", error)
    return NextResponse.json(
      { error: "Failed to delete recurring transaction" },
      { status: 500 }
    )
  }
}
