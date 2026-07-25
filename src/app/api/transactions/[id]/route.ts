import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateTransactionSchema, safeParseBody } from "@/lib/validation"

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
    const existing = await prisma.transaction.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
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
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await prisma.transaction.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.transaction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete transaction error:", error)
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    )
  }
}
