import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createTransactionSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { parsePagination, paginatedResponse } from "@/lib/utils"
import type { Prisma } from "@prisma/client"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`transactions-get:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const url = new URL(req.url)
  const searchQuery = url.searchParams.get("search")?.trim()
  const typeFilter = url.searchParams.get("type")?.trim()

  const where: Prisma.TransactionWhereInput = {
    userId: session.user.id,
    ...(searchQuery
      ? { description: { contains: searchQuery, mode: "insensitive" } }
      : {}),
    ...(typeFilter && (typeFilter === "INCOME" || typeFilter === "EXPENSE")
      ? { type: typeFilter }
      : {}),
  }

  const pagination = parsePagination(req.url)

  if (!pagination) {
    // Legacy: return plain array when no pagination params
    const transactions = await prisma.transaction.findMany({
      where,
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

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.transaction.count({ where }),
  ])

  const mapped = transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    description: tx.description,
    date: tx.date.toISOString(),
  }))

  return NextResponse.json(paginatedResponse(mapped, total, pagination))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 30 transactions per minute per user
  const limiter = rateLimit(`transactions:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createTransactionSchema)
    if ("error" in parsed) return parsed.error

    const { type, category, amount, description, date } = parsed.data

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

    return NextResponse.json(
      {
        id: transaction.id,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create transaction error:", error)
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    )
  }
}
