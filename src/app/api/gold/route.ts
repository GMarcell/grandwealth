import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createGoldSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { parsePagination, paginatedResponse } from "@/lib/utils"
import type { Prisma } from "@prisma/client"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`gold-get:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const url = new URL(req.url)
  const searchQuery = url.searchParams.get("search")?.trim()
  const typeFilter = url.searchParams.get("type")?.trim()

  const where: Prisma.GoldDepositWhereInput = {
    userId: session.user.id,
    ...(searchQuery
      ? { notes: { contains: searchQuery, mode: "insensitive" } }
      : {}),
    ...(typeFilter && (typeFilter === "BUY" || typeFilter === "SELL")
      ? { type: typeFilter }
      : {}),
  }

  const pagination = parsePagination(req.url, 25)

  if (!pagination) {
    // Legacy: return plain array when no pagination params
    const deposits = await prisma.goldDeposit.findMany({
      where,
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

  const [deposits, total, allDeposits] = await Promise.all([
    prisma.goldDeposit.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.goldDeposit.count({ where }),
    prisma.goldDeposit.findMany({
      where,
      select: { type: true, weightGram: true, totalAmount: true },
    }),
  ])

  // Compute aggregate summaries from ALL records (not just current page)
  let totalWeight = 0
  let totalInvested = 0
  for (const d of allDeposits) {
    if (d.type === "BUY") {
      totalWeight += d.weightGram
      totalInvested += d.totalAmount
    } else {
      totalWeight -= d.weightGram
    }
  }

  const mapped = deposits.map((d) => ({
    id: d.id,
    type: d.type,
    weightGram: d.weightGram,
    pricePerGram: d.pricePerGram,
    totalAmount: d.totalAmount,
    date: d.date.toISOString(),
    notes: d.notes,
  }))

  return NextResponse.json({
    ...paginatedResponse(mapped, total, pagination),
    summary: {
      totalWeight: Math.round(totalWeight * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
    },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`gold:${getRateLimitKey(req)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createGoldSchema)
    if ("error" in parsed) return parsed.error

    const { type, weightGram, pricePerGram, totalAmount, date, notes } = parsed.data

    const deposit = await prisma.goldDeposit.create({
      data: {
        type,
        weightGram,
        pricePerGram,
        totalAmount: totalAmount ?? weightGram * pricePerGram,
        date: date ? new Date(date) : new Date(),
        notes: notes ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: deposit.id,
        type: deposit.type,
        weightGram: deposit.weightGram,
        pricePerGram: deposit.pricePerGram,
        totalAmount: deposit.totalAmount,
        date: deposit.date.toISOString(),
        notes: deposit.notes,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create gold deposit error:", error)
    return NextResponse.json(
      { error: "Failed to create gold record" },
      { status: 500 }
    )
  }
}
