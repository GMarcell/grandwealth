import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createStockSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

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

  const limiter = rateLimit(`stocks:${getRateLimitKey(req)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createStockSchema)
    if ("error" in parsed) return parsed.error

    const { symbol, name, quantity, buyPrice, date, notes } = parsed.data

    const stock = await prisma.stock.create({
      data: {
        symbol,
        name,
        quantity,
        buyPrice,
        date: date ? new Date(date) : new Date(),
        notes: notes ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        quantity: stock.quantity,
        buyPrice: stock.buyPrice,
        currentPrice: stock.currentPrice,
        lastPriceUpdated: stock.lastPriceUpdated?.toISOString() ?? null,
        date: stock.date.toISOString(),
        notes: stock.notes,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create stock error:", error)
    return NextResponse.json(
      { error: "Failed to create stock" },
      { status: 500 }
    )
  }
}

