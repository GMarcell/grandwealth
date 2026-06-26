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
    const existing = await prisma.transaction.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { type, category, amount, description, date } = await req.json()
    const data: any = {}
    if (type) data.type = type
    if (category) data.category = category
    if (amount) data.amount = amount
    if (description) data.description = description
    if (date) data.date = new Date(date)

    const updated = await prisma.transaction.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
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
