import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateBudgetSchema, safeParseBody } from "@/lib/validation"

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
    const existing = await prisma.budget.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateBudgetSchema)
    if ("error" in parsed) return parsed.error

    const { amount, rolloverEnabled, rolloverCap } = parsed.data
    const data: Record<string, unknown> = {}
    if (amount !== undefined) data.amount = amount
    if (rolloverEnabled !== undefined) data.rolloverEnabled = rolloverEnabled
    if (rolloverCap !== undefined) data.rolloverCap = rolloverCap

    const updated = await prisma.budget.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      id: updated.id,
      categoryName: updated.categoryName,
      amount: updated.amount,
      month: updated.month,
      rolloverEnabled: updated.rolloverEnabled,
      rolloverCap: updated.rolloverCap,
    })
  } catch (error) {
    console.error("Update budget error:", error)
    return NextResponse.json(
      { error: "Failed to update budget" },
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
    const existing = await prisma.budget.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.budget.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete budget error:", error)
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 500 }
    )
  }
}
