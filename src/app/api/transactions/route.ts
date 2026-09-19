import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createTransactionSchema, safeParseBody } from "@/lib/validation"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { parsePagination, paginatedResponse } from "@/lib/utils"
import { getBudgetMonthRange } from "@/lib/budget-months"
import { RULE_TYPES } from "@/lib/rule-type"
import type { Prisma } from "@prisma/client"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limiter = await rateLimit(`transactions-get:${getRateLimitKey(req)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

  const url = new URL(req.url)
  const searchQuery = url.searchParams.get("search")?.trim()
  const typeFilter = url.searchParams.get("type")?.trim()
  const monthFilter = url.searchParams.get("month")?.trim()
  const ruleFilter = url.searchParams.get("rule")?.trim()
  const wantsCategorySummary =
    url.searchParams.get("summaryByCategory") === "1"

  const where: Prisma.TransactionWhereInput = {
    userId: session.user.id,
    ...(searchQuery
      ? { description: { contains: searchQuery, mode: "insensitive" } }
      : {}),
    ...(typeFilter && (typeFilter === "INCOME" || typeFilter === "EXPENSE")
      ? { type: typeFilter }
      : {}),
  }

  // Month filter uses the user's budget-month boundaries so it lines up with
  // budgets, the dashboard, and the analysis pages.
  if (monthFilter && monthFilter !== "ALL") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { budgetStartDay: true },
    })
    const startDay = user?.budgetStartDay ?? 1
    const { start, end } = getBudgetMonthRange(monthFilter, startDay)
    where.date = { gte: start, lte: end }
  }

  // Rule filter resolves category names to their 50/30/20 classification.
  // Categories without a rule type (and any uncategorized name) count as OTHER.
  if (ruleFilter && ruleFilter !== "ALL") {
    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
      select: { name: true, ruleType: true },
    })
    const classifiedNames = categories
      .filter((c) => RULE_TYPES.includes(c.ruleType as any))
      .map((c) => c.name)

    if (ruleFilter === "OTHER") {
      where.category = { notIn: classifiedNames }
    } else if (RULE_TYPES.includes(ruleFilter as any)) {
      where.category = {
        in: categories
          .filter((c) => c.ruleType === ruleFilter)
          .map((c) => c.name),
      }
    }
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

  const [transactions, total, summaryRows, categoryRows] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.transaction.count({ where }),
    // Totals span the whole filtered set, not just the current page.
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    }),
    // Optional per-category spend (e.g. full-month budget alerts) that also
    // spans the whole filtered set rather than the current page.
    wantsCategorySummary
      ? prisma.transaction.groupBy({
          by: ["category"],
          where,
          _sum: { amount: true },
        })
      : Promise.resolve(
          [] as Array<{ category: string; _sum: { amount: number | null } }>,
        ),
  ])

  const mapped = transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    description: tx.description,
    date: tx.date.toISOString(),
  }))

  const summary = {
    totalIncome:
      summaryRows.find((row) => row.type === "INCOME")?._sum.amount ?? 0,
    totalExpenses:
      summaryRows.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0,
    ...(wantsCategorySummary
      ? {
          byCategory: Object.fromEntries(
            categoryRows.map((row) => [row.category, row._sum.amount ?? 0]),
          ),
        }
      : {}),
  }

  return NextResponse.json({
    ...paginatedResponse(mapped, total, pagination),
    summary,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 30 transactions per minute per user
  const limiter = await rateLimit(`transactions:${session.user.id}`, {
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
