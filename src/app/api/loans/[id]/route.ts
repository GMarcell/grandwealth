import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { updateLoanSchema, safeParseBody } from "@/lib/validation"
import { shortCircuitIdempotent, recordIdempotencyKey } from "@/lib/idempotency"

async function getOwnedLoan(id: string, userId: string) {
  const loan = await prisma.loan.findUnique({ where: { id } })
  if (!loan || loan.userId !== userId) return null
  return loan
}

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

    const existing = await getOwnedLoan(id, userId)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const parsed = await safeParseBody(req, updateLoanSchema)
    if ("error" in parsed) return parsed.error

    const { name, principal, remainingBalance, interestRate, monthlyPayment, startDate, notes } = parsed.data
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (principal !== undefined) data.principal = principal
    if (remainingBalance !== undefined) data.remainingBalance = remainingBalance
    if (interestRate !== undefined) data.interestRate = interestRate
    if (monthlyPayment !== undefined) data.monthlyPayment = monthlyPayment
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (notes !== undefined) data.notes = notes

    const loan = await prisma.loan.update({ where: { id }, data })

    await recordIdempotencyKey(req, userId)

    return NextResponse.json({
      id: loan.id,
      name: loan.name,
      principal: loan.principal,
      remainingBalance: loan.remainingBalance,
      interestRate: loan.interestRate,
      monthlyPayment: loan.monthlyPayment,
      startDate: loan.startDate.toISOString(),
      notes: loan.notes,
      createdAt: loan.createdAt.toISOString(),
    })
  } catch (error) {
    console.error("Update loan error:", error)
    return NextResponse.json(
      { error: "Failed to update loan" },
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

    const existing = await getOwnedLoan(id, userId)
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.loan.delete({ where: { id } })
    await recordIdempotencyKey(req, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete loan error:", error)
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500 }
    )
  }
}
