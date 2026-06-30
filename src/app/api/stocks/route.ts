import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stocks = await prisma.stock.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(
    stocks.map((s) => ({
      id: s.id,
      symbol: s.symbol,
      name: s.name,
      quantity: s.quantity,
      buyPrice: s.buyPrice,
      currentPrice: s.currentPrice,
      lastPriceUpdated: s.lastPriceUpdated?.toISOString() ?? null,
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

  try {
    const { symbol, name, quantity, buyPrice, date, notes } = await req.json()

    if (!symbol || !name || !quantity || !buyPrice) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const stock = await prisma.stock.create({
      data: {
        symbol: symbol.toUpperCase(),
        name,
        quantity,
        buyPrice,
        date: date ? new Date(date) : new Date(),
        notes,
        userId: session.user.id,
      },
    })

    return NextResponse.json(stock, { status: 201 })
  } catch (error) {
    console.error("Create stock error:", error)
    return NextResponse.json(
      { error: "Failed to create stock" },
      { status: 500 }
    )
  }
}

