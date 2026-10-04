import { NextResponse } from "next/server"
import { requireUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { updateTransactionSchema, safeParseBody } from "@/lib/validation"
import { shortCircuitIdempotent, recordIdempotencyKey } from "@/lib/idempotency"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId

  const { id } = await params

  try {
    // Replayed offline write: the original already applied, so skip the update.
    const replayed = await shortCircuitIdempotent(req, userId)
    if (replayed) return replayed

    const existing = await prisma.transaction.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateTransactionSchema)
    if ("error" in parsed) return parsed.error

    const { type, category, amount, description, date } = parsed.data
    const data: Record<string, unknown> = {}
    if (type !== undefined) data.type = type
    if (category !== undefined) data.category = category
    if (amount !== undefined) data.amount = amount
    if (description !== undefined) data.description = description
    if (date !== undefined) data.date = new Date(date)

    const updated = await prisma.transaction.update({
      where: { id },
      data,
    })

    await recordIdempotencyKey(req, userId)

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      category: updated.category,
      amount: updated.amount,
      description: updated.description,
      date: updated.date.toISOString(),
    })
  } catch (error) {
    console.error("Update transaction error:", error)
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId

  const { id } = await params

  try {
    // Replayed offline delete: the original already applied.
    const replayed = await shortCircuitIdempotent(req, userId)
    if (replayed) return replayed

    const existing = await prisma.transaction.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.transaction.delete({ where: { id } })
    await recordIdempotencyKey(req, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete transaction error:", error)
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    )
  }
}
