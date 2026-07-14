import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    const { symbol, name, quantity, buyPrice, date, notes } = await req.json()
    const data: any = {}
    if (symbol) data.symbol = symbol.toUpperCase().replace(/\.JK$/, "")
    if (name) data.name = name
    if (quantity) data.quantity = quantity
    if (buyPrice) data.buyPrice = buyPrice
    if (date) data.date = new Date(date)
    if (notes !== undefined) data.notes = notes

    const updated = await prisma.stock.update({ where: { id }, data })
    return NextResponse.json(updated)
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
