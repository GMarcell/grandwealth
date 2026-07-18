import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createStockSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { fetchStockPrice } from "@/lib/prices"
import { parsePagination, paginatedResponse } from "@/lib/utils"
import type { Prisma } from "@prisma/client"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`stocks-get:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const url = new URL(req.url)
  const searchQuery = url.searchParams.get("search")?.trim()

  const where: Prisma.StockWhereInput = {
    userId: session.user.id,
    ...(searchQuery
      ? {
          OR: [
            { symbol: { contains: searchQuery, mode: "insensitive" } },
            { name: { contains: searchQuery, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const pagination = parsePagination(req.url, 25)

  if (!pagination) {
    // Legacy: return plain array when no pagination params
    const stocks = await prisma.stock.findMany({
      where,
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

  const [stocks, total] = await Promise.all([
    prisma.stock.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.stock.count({ where }),
  ])

  const mapped = stocks.map((s) => ({
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

  return NextResponse.json(paginatedResponse(mapped, total, pagination))
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

    const { name, quantity, buyPrice, date, notes } = parsed.data
    // Normalize symbol: strip .JK suffix if present (e.g., "ANTM.JK" → "ANTM")
    const symbol = parsed.data.symbol.toUpperCase().replace(/\.JK$/, "")

    // Create the stock record
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

    // Auto-fetch live price from Yahoo Finance
    let currentPrice = stock.currentPrice
    let lastPriceUpdated = stock.lastPriceUpdated
    try {
      const priceResult = await fetchStockPrice(symbol)
      if (priceResult?.price != null) {
        currentPrice = priceResult.price
        lastPriceUpdated = new Date()
        // Update the stock with the live price
        await prisma.stock.update({
          where: { id: stock.id },
          data: {
            currentPrice: currentPrice,
            lastPriceUpdated: lastPriceUpdated,
          },
        })
      }
    } catch {
      // Non-blocking — auto-fetch failed, stock still created without live price
      console.warn(`Could not auto-fetch price for ${symbol}`)
    }

    return NextResponse.json(
      {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        quantity: stock.quantity,
        buyPrice: stock.buyPrice,
        currentPrice,
        lastPriceUpdated: lastPriceUpdated?.toISOString() ?? null,
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

