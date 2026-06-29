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

  try {
    const { id } = await params
    const existing = await prisma.recurringTransaction.findUnique({
      where: { id },
    })

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()
    const updateData: any = {}

    if (body.type !== undefined) updateData.type = body.type
    if (body.category !== undefined) updateData.category = body.category
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.description !== undefined) updateData.description = body.description
    if (body.frequency !== undefined) updateData.frequency = body.frequency
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.nextDate !== undefined) updateData.nextDate = new Date(body.nextDate)
    if (body.active !== undefined) updateData.active = body.active

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: updateData,
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
