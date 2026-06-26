import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(
    transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      description: tx.description,
      date: tx.date.toISOString(),
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { type, category, amount, description, date } = await req.json()

    if (!type || !category || !amount || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const transaction = await prisma.transaction.create({
      data: {
        type,
        category,
        amount,
        description,
        date: date ? new Date(date) : new Date(),
        userId: session.user.id,
      },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error("Create transaction error:", error)
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    )
  }
}
