import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { updateDividendSchema, safeParseBody } from "@/lib/validation"

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
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const { id } = await params

  try {
    const existing = await getOwnedDividend(id, session.user.id)
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
      if (!stock || stock.userId !== session.user.id) {
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
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

  const { id } = await params

  try {
    const existing = await getOwnedDividend(id, session.user.id)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.dividend.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete dividend error:", error)
    return NextResponse.json(
      { error: "Failed to delete dividend" },
      { status: 500 }
    )
  }
}
