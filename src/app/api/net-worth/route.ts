import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeNetWorthHistory } from "@/lib/wealth-history"
import { computeGoldPortfolio } from "@/lib/gold"
import { fetchGoldPriceIdr } from "@/lib/prices"

/**
 * GET /api/net-worth?months=12
 * Returns a month-by-month net-worth series computed from the user's records.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const monthsParam = parseInt(url.searchParams.get("months") ?? "12", 10)
  const months = Math.min(36, Math.max(3, isNaN(monthsParam) ? 12 : monthsParam))

  try {
    const [transactions, goldDeposits, stocks, bankSavings, loans] =
      await Promise.all([
        prisma.transaction.findMany({
          where: { userId: session.user.id },
          select: { type: true, amount: true, date: true },
          orderBy: { date: "asc" },
        }),
        prisma.goldDeposit.findMany({
          where: { userId: session.user.id },
          select: { type: true, weightGram: true, totalAmount: true, date: true },
          orderBy: { date: "asc" },
        }),
        prisma.stock.findMany({
          where: { userId: session.user.id },
          select: { quantity: true, buyPrice: true, currentPrice: true, date: true },
          orderBy: { date: "asc" },
        }),
        prisma.bankSaving.findMany({
          where: { userId: session.user.id },
          select: { type: true, amount: true, date: true },
          orderBy: { date: "asc" },
        }),
        prisma.loan.findMany({
          where: { userId: session.user.id },
          select: { startDate: true, remainingBalance: true },
        }),
      ])

    // Use the live gold price when the user currently HOLDS gold (net weight
    // > 0) and the fetch succeeds — the same rule /api/dashboard uses. Falls
    // back to cost basis otherwise and skips the external call entirely when
    // there is nothing left to mark to market (e.g. everything was sold).
    const heldGoldWeight = computeGoldPortfolio(goldDeposits).totalWeight
    let goldPricePerGram: number | null = null
    if (heldGoldWeight > 0) {
      try {
        const price = await fetchGoldPriceIdr()
        goldPricePerGram = price.pricePerGramIdr
      } catch {
        console.warn("Could not fetch gold price for net-worth history; using cost basis")
      }
    }

    const history = computeNetWorthHistory({
      transactions,
      goldDeposits,
      stocks,
      bankSavings,
      loans,
      goldPricePerGram,
      months,
    })

    const latest = history[history.length - 1] ?? null

    return NextResponse.json({
      months,
      history,
      latest,
      goldPricePerGram,
    })
  } catch (error) {
    console.error("Net worth history error:", error)
    return NextResponse.json(
      { error: "Failed to compute net worth history" },
      { status: 500 }
    )
  }
}
