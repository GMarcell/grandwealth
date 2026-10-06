import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { updateBudgetSchema, safeParseBody } from "@/lib/validation"
import { shortCircuitIdempotent, recordIdempotencyKey } from "@/lib/idempotency"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

  const { id } = await params

  try {
    const replayed = await shortCircuitIdempotent(req, userId)
    if (replayed) return replayed

    const existing = await prisma.budget.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateBudgetSchema)
    if ("error" in parsed) return parsed.error

    const { amount, rolloverCap, canReduce } = parsed.data
    const data: Record<string, unknown> = {}
    if (amount !== undefined) data.amount = amount
    if (rolloverCap !== undefined) data.rolloverCap = rolloverCap
    if (canReduce !== undefined) data.canReduce = canReduce

    const updated = await prisma.budget.update({
      where: { id },
      data,
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
  } catch (error) {
    console.error("Update budget error:", error)
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

  const { id } = await params

  try {
    const replayed = await shortCircuitIdempotent(req, userId)
    if (replayed) return replayed

    const existing = await prisma.budget.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.budget.delete({ where: { id } })
    await recordIdempotencyKey(req, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete budget error:", error)
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 500 }
    )
  }
}
