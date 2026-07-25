import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateGoldSchema, safeParseBody } from "@/lib/validation"

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

    const parsed = await safeParseBody(req, updateGoldSchema)
    if ("error" in parsed) return parsed.error

    const { type, weightGram, pricePerGram, totalAmount, date, notes } = parsed.data
    const data: Record<string, unknown> = {}
    if (type !== undefined) data.type = type
    if (weightGram !== undefined) data.weightGram = weightGram
    if (pricePerGram !== undefined) data.pricePerGram = pricePerGram
    if (totalAmount !== undefined) data.totalAmount = totalAmount
    if (date !== undefined) data.date = new Date(date)
    if (notes !== undefined) data.notes = notes

    const updated = await prisma.goldDeposit.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      weightGram: updated.weightGram,
      pricePerGram: updated.pricePerGram,
      totalAmount: updated.totalAmount,
      date: updated.date.toISOString(),
      notes: updated.notes,
    })
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
