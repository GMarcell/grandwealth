import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fetchStockPrices } from "@/lib/prices"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stocks = await prisma.stock.findMany({
      where: { userId: session.user.id },
      select: { id: true, symbol: true },
    })

    if (stocks.length === 0) {
      return NextResponse.json({ message: "No stocks to update", count: 0 })
    }

    const symbols = stocks.map((s) => s.symbol)
    const prices = await fetchStockPrices(symbols)

    let updatedCount = 0
    const now = new Date()

    for (const stock of stocks) {
      const price = prices.get(stock.symbol)
      if (price != null) {
        await prisma.stock.update({
          where: { id: stock.id },
          data: {
            currentPrice: price,
            lastPriceUpdated: now,
          },
        })
        updatedCount++
      }
    }

    return NextResponse.json({
      message: "Stock prices updated",
      count: updatedCount,
      total: stocks.length,
      updatedAt: now.toISOString(),
    })
  } catch (error) {
    console.error("Update stock prices error:", error)
    return NextResponse.json(
      { error: "Failed to update stock prices" },
      { status: 500 }
    )
  }
}
