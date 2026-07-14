import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createBankSavingSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const savings = await prisma.bankSaving.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(
    savings.map((s) => ({
      id: s.id,
      type: s.type,
      accountName: s.accountName,
      amount: s.amount,
      date: s.date.toISOString(),
      notes: s.notes,
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`savings:${getRateLimitKey(req)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createBankSavingSchema)
    if ("error" in parsed) return parsed.error

    const { type, accountName, amount, date, notes } = parsed.data

    const saving = await prisma.bankSaving.create({
      data: {
        type,
        accountName,
        amount,
        date: date ? new Date(date) : new Date(),
        notes: notes ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: saving.id,
        type: saving.type,
        accountName: saving.accountName,
        amount: saving.amount,
        date: saving.date.toISOString(),
        notes: saving.notes,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create saving error:", error)
    return NextResponse.json(
      { error: "Failed to create savings record" },
      { status: 500 }
    )
  }
}
