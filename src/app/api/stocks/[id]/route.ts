import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateStockSchema, safeParseBody } from "@/lib/validation"

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
    const existing = await prisma.stock.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateStockSchema)
    if ("error" in parsed) return parsed.error

    const { symbol, name, quantity, buyPrice, date, notes } = parsed.data
    const data: Record<string, unknown> = {}
    if (symbol !== undefined) data.symbol = symbol.toUpperCase().replace(/\.JK$/, "")
    if (name !== undefined) data.name = name
    if (quantity !== undefined) data.quantity = quantity
    if (buyPrice !== undefined) data.buyPrice = buyPrice
    if (date !== undefined) data.date = new Date(date)
    if (notes !== undefined) data.notes = notes

    const updated = await prisma.stock.update({ where: { id }, data })
    return NextResponse.json({
      id: updated.id,
      symbol: updated.symbol,
      name: updated.name,
      quantity: updated.quantity,
      buyPrice: updated.buyPrice,
      currentPrice: updated.currentPrice,
      lastPriceUpdated: updated.lastPriceUpdated?.toISOString() ?? null,
      date: updated.date.toISOString(),
      notes: updated.notes,
    })
  } catch (error) {
    console.error("Update stock error:", error)
    return NextResponse.json(
      { error: "Failed to update stock" },
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
    const existing = await prisma.stock.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.stock.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete stock error:", error)
    return NextResponse.json(
      { error: "Failed to delete stock" },
      { status: 500 }
    )
  }
}
