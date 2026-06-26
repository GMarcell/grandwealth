import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const deposits = await prisma.goldDeposit.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(
    deposits.map((d) => ({
      id: d.id,
      type: d.type,
      weightGram: d.weightGram,
      pricePerGram: d.pricePerGram,
      totalAmount: d.totalAmount,
      date: d.date.toISOString(),
      notes: d.notes,
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { type, weightGram, pricePerGram, totalAmount, date, notes } =
      await req.json()

    if (!type || !weightGram || !pricePerGram) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const deposit = await prisma.goldDeposit.create({
      data: {
        type,
        weightGram,
        pricePerGram,
        totalAmount,
        date: date ? new Date(date) : new Date(),
        notes,
        userId: session.user.id,
      },
    })

    return NextResponse.json(deposit, { status: 201 })
  } catch (error) {
    console.error("Create gold deposit error:", error)
    return NextResponse.json(
      { error: "Failed to create gold record" },
      { status: 500 }
    )
  }
}
