import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { updateDividendSchema, safeParseBody } from "@/lib/validation"
import { shortCircuitIdempotent, recordIdempotencyKey } from "@/lib/idempotency"

async function getOwnedDividend(id: string, userId: string) {
  const dividend = await prisma.dividend.findUnique({
    where: { id },
    include: { stock: { select: { symbol: true, name: true } } },
  })
  if (!dividend || dividend.userId !== userId) return null
  return dividend
}

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

    const existing = await getOwnedDividend(id, userId)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateDividendSchema)
    if ("error" in parsed) return parsed.error

    const { stockId, amount, date, notes } = parsed.data

    // When re-pointing the dividend at a different stock, verify the target
    // belongs to this user — otherwise a user could link their dividend to
    // another user's holding, and deleting that holding would cascade-delete
    // this dividend record (data loss across users).
    if (stockId !== undefined) {
      const stock = await prisma.stock.findUnique({ where: { id: stockId } })
      if (!stock || stock.userId !== userId) {
        return NextResponse.json({ error: "Stock not found" }, { status: 404 })
      }
    }

    const data: Record<string, unknown> = {}
    if (stockId !== undefined) data.stockId = stockId
    if (amount !== undefined) data.amount = amount
    if (date !== undefined) data.date = new Date(date)
    if (notes !== undefined) data.notes = notes

    const dividend = await prisma.dividend.update({
      where: { id },
      data,
      include: { stock: { select: { symbol: true, name: true } } },
    })

    await recordIdempotencyKey(req, userId)

    return NextResponse.json({
      id: dividend.id,
      stockId: dividend.stockId,
      symbol: dividend.stock.symbol,
      stockName: dividend.stock.name,
      amount: dividend.amount,
      date: dividend.date.toISOString(),
      notes: dividend.notes,
    })
  } catch (error) {
    console.error("Update dividend error:", error)
    return NextResponse.json(
      { error: "Failed to update dividend" },
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

    const existing = await getOwnedDividend(id, userId)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.dividend.delete({ where: { id } })
    await recordIdempotencyKey(req, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete dividend error:", error)
    return NextResponse.json(
      { error: "Failed to delete dividend" },
      { status: 500 }
    )
  }
}
