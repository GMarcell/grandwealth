import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createLoanSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loans = await prisma.loan.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
  })

  return NextResponse.json(
    loans.map((l) => ({
      id: l.id,
      name: l.name,
      principal: l.principal,
      remainingBalance: l.remainingBalance,
      interestRate: l.interestRate,
      monthlyPayment: l.monthlyPayment,
      startDate: l.startDate.toISOString(),
      notes: l.notes,
      createdAt: l.createdAt.toISOString(),
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = await rateLimit(`loans:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createLoanSchema)
    if ("error" in parsed) return parsed.error

    const { name, principal, remainingBalance, interestRate, monthlyPayment, startDate, notes } = parsed.data

    const loan = await prisma.loan.create({
      data: {
        name,
        principal,
        remainingBalance,
        interestRate: interestRate ?? null,
        monthlyPayment: monthlyPayment ?? null,
        startDate: new Date(startDate),
        notes: notes ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: loan.id,
        name: loan.name,
        principal: loan.principal,
        remainingBalance: loan.remainingBalance,
        interestRate: loan.interestRate,
        monthlyPayment: loan.monthlyPayment,
        startDate: loan.startDate.toISOString(),
        notes: loan.notes,
        createdAt: loan.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create loan error:", error)
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500 }
    )
  }
}
