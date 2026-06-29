import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const recurring = await prisma.recurringTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { nextDate: "asc" },
  })

  return NextResponse.json(
    recurring.map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      amount: r.amount,
      description: r.description,
      frequency: r.frequency,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate?.toISOString() ?? null,
      nextDate: r.nextDate.toISOString(),
      active: r.active,
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { type, category, amount, description, frequency, startDate, endDate, nextDate } = await req.json()

    if (!type || !category || !amount || !description || !frequency || !startDate || !nextDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (!["INCOME", "EXPENSE"].includes(type)) {
      return NextResponse.json({ error: "Type must be INCOME or EXPENSE" }, { status: 400 })
    }

    if (!["WEEKLY", "MONTHLY", "YEARLY"].includes(frequency)) {
      return NextResponse.json({ error: "Frequency must be WEEKLY, MONTHLY, or YEARLY" }, { status: 400 })
    }

    const recurring = await prisma.recurringTransaction.create({
      data: {
        type,
        category,
        amount,
        description,
        frequency,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        nextDate: new Date(nextDate),
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: recurring.id,
        type: recurring.type,
        category: recurring.category,
        amount: recurring.amount,
        description: recurring.description,
        frequency: recurring.frequency,
        startDate: recurring.startDate.toISOString(),
        endDate: recurring.endDate?.toISOString() ?? null,
        nextDate: recurring.nextDate.toISOString(),
        active: recurring.active,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create recurring error:", error)
    return NextResponse.json(
      { error: "Failed to create recurring transaction" },
      { status: 500 }
    )
  }
}
