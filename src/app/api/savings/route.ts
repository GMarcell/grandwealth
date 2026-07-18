import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createBankSavingSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { parsePagination, paginatedResponse } from "@/lib/utils"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`savings-get:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const url = new URL(req.url)
  const searchQuery = url.searchParams.get("search")?.trim()

  const where: Prisma.BankSavingWhereInput = {
    userId: session.user.id,
    ...(searchQuery
      ? {
          OR: [
            { accountName: { contains: searchQuery, mode: "insensitive" } },
            { notes: { contains: searchQuery, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const pagination = parsePagination(req.url, 25)

  if (!pagination) {
    // Legacy: return plain array when no pagination params
    const savings = await prisma.bankSaving.findMany({
      where,
      orderBy: { date: "desc" },
    })
    return NextResponse.json(
      savings.map((s) => ({
        id: s.id,
        type: s.type,
        accountName: s.accountName,
        amount: s.amount,
        date: s.date.toISOString(),
        notes: s.notes,
      }))
    )
  }

  const [savings, total, allSavings] = await Promise.all([
    prisma.bankSaving.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.bankSaving.count({ where }),
    prisma.bankSaving.findMany({
      where,
      select: { type: true, accountName: true, amount: true },
    }),
  ])

  // Compute aggregate summaries from ALL records (not just current page)
  let totalDeposits = 0
  let totalWithdrawals = 0
  const accountMap = new Map<string, { deposits: number; withdrawals: number }>()
  for (const s of allSavings) {
    if (s.type === "DEPOSIT") {
      totalDeposits += s.amount
    } else {
      totalWithdrawals += s.amount
    }
    if (!accountMap.has(s.accountName)) {
      accountMap.set(s.accountName, { deposits: 0, withdrawals: 0 })
    }
    const acc = accountMap.get(s.accountName)!
    if (s.type === "DEPOSIT") {
      acc.deposits += s.amount
    } else {
      acc.withdrawals += s.amount
    }
  }

  const accountSummaries = Array.from(accountMap.entries()).map(([name, data]) => ({
    name,
    deposits: data.deposits,
    withdrawals: data.withdrawals,
    balance: data.deposits - data.withdrawals,
  }))

  const mapped = savings.map((s) => ({
    id: s.id,
    type: s.type,
    accountName: s.accountName,
    amount: s.amount,
    date: s.date.toISOString(),
    notes: s.notes,
  }))

  return NextResponse.json({
    ...paginatedResponse(mapped, total, pagination),
    summary: {
      totalDeposits: Math.round(totalDeposits * 100) / 100,
      totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
      netSavings: Math.round((totalDeposits - totalWithdrawals) * 100) / 100,
      uniqueAccounts: accountSummaries.length,
      accountSummaries,
    },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = rateLimit(`savings:${getRateLimitKey(req)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  try {
    const parsed = await safeParseBody(req, createBankSavingSchema)
    if ("error" in parsed) return parsed.error

    const { type, accountName, amount, date, notes } = parsed.data

    const saving = await prisma.bankSaving.create({
      data: {
        type,
        accountName,
        amount,
        date: date ? new Date(date) : new Date(),
        notes: notes ?? null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        id: saving.id,
        type: saving.type,
        accountName: saving.accountName,
        amount: saving.amount,
        date: saving.date.toISOString(),
        notes: saving.notes,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create saving error:", error)
    return NextResponse.json(
      { error: "Failed to create savings record" },
      { status: 500 }
    )
  }
}
