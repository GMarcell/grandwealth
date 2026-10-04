import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { updateBankSavingSchema, safeParseBody } from "@/lib/validation"
import type { Prisma } from "@prisma/client"
import { shortCircuitIdempotent, recordIdempotencyKey } from "@/lib/idempotency"

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

    const existing = await prisma.bankSaving.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateBankSavingSchema)
    if ("error" in parsed) return parsed.error

    const { type, accountName, amount, date, notes } = parsed.data
    const data: Prisma.BankSavingUpdateInput = {}
    if (type) data.type = type
    if (accountName) data.accountName = accountName
    if (amount) data.amount = amount
    if (date) data.date = new Date(date)
    if (notes !== undefined) data.notes = notes

    const updated = await prisma.bankSaving.update({ where: { id }, data })
    await recordIdempotencyKey(req, userId)
    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      accountName: updated.accountName,
      amount: updated.amount,
      date: updated.date.toISOString(),
      notes: updated.notes,
    })
  } catch (error) {
    console.error("Update saving error:", error)
    return NextResponse.json(
      { error: "Failed to update savings record" },
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

    const existing = await prisma.bankSaving.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.bankSaving.delete({ where: { id } })
    await recordIdempotencyKey(req, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete saving error:", error)
    return NextResponse.json(
      { error: "Failed to delete savings record" },
      { status: 500 }
    )
  }
}
