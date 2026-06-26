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
    const existing = await prisma.goldDeposit.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { type, weightGram, pricePerGram, totalAmount, date, notes } =
      await req.json()
    const data: any = {}
    if (type) data.type = type
    if (weightGram) data.weightGram = weightGram
    if (pricePerGram) data.pricePerGram = pricePerGram
    if (totalAmount) data.totalAmount = totalAmount
    if (date) data.date = new Date(date)
    if (notes !== undefined) data.notes = notes

    const updated = await prisma.goldDeposit.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update gold deposit error:", error)
    return NextResponse.json(
      { error: "Failed to update gold record" },
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
    const existing = await prisma.goldDeposit.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.goldDeposit.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete gold deposit error:", error)
    return NextResponse.json(
      { error: "Failed to delete gold record" },
      { status: 500 }
    )
  }
}
