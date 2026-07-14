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
    const failed: string[] = []

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
      } else {
        failed.push(stock.symbol)
      }
    }

    if (failed.length > 0 && updatedCount === 0) {
      return NextResponse.json(
        {
          error: `Could not fetch any prices from Yahoo Finance for: ${failed.join(", ")}. These symbols may be invalid or delisted.`,
          failed,
          count: 0,
          total: stocks.length,
        },
        { status: 502 }
      )
    }

    const response: any = {
      message: updatedCount === stocks.length
        ? "Stock prices updated"
        : `Partially updated: ${updatedCount}/${stocks.length} stocks`,
      count: updatedCount,
      total: stocks.length,
      updatedAt: now.toISOString(),
    }
    if (failed.length > 0) {
      response.failed = failed
      response.warning = `Could not fetch prices for: ${failed.join(", ")}`
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Update stock prices error:", error)
    return NextResponse.json(
      { error: "Failed to update stock prices" },
      { status: 500 }
    )
  }
}
