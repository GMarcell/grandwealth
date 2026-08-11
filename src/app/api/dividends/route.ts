import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createDividendSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const stockId = url.searchParams.get("stockId")

  const dividends = await prisma.dividend.findMany({
    where: {
      userId: session.user.id,
      ...(stockId ? { stockId } : {}),
    },
    include: { stock: { select: { symbol: true, name: true } } },
    orderBy: { date: "desc" },
    take: 100,
  })

  const totalAmount = dividends.reduce((sum, d) => sum + d.amount, 0)

  return NextResponse.json({
    data: dividends.map((d) => ({
      id: d.id,
      stockId: d.stockId,
      symbol: d.stock.symbol,
      stockName: d.stock.name,
      amount: d.amount,
      date: d.date.toISOString(),
      notes: d.notes,
    })),
    totalAmount,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = await rateLimit(`dividends:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createDividendSchema)
    if ("error" in parsed) return parsed.error

    const { stockId, amount, date, notes } = parsed.data

    // Verify the stock belongs to the user.
    const stock = await prisma.stock.findUnique({ where: { id: stockId } })
    if (!stock || stock.userId !== session.user.id) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 })
    }

    const dividend = await prisma.dividend.create({
      data: {
        stockId,
        amount,
        date: date ? new Date(date) : new Date(),
        notes: notes ?? null,
        userId: session.user.id,
      },
      include: { stock: { select: { symbol: true, name: true } } },
    })

    return NextResponse.json(
      {
        id: dividend.id,
        stockId: dividend.stockId,
        symbol: dividend.stock.symbol,
        stockName: dividend.stock.name,
        amount: dividend.amount,
        date: dividend.date.toISOString(),
        notes: dividend.notes,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create dividend error:", error)
    return NextResponse.json(
      { error: "Failed to create dividend" },
      { status: 500 }
    )
  }
}
