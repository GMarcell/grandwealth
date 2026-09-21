import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseCsv } from "@/lib/csv"
import { rateLimit } from "@/lib/rate-limit"

/** Reject uploads larger than this before reading them into memory. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024 // 2 MB
/** Upper bound on imported rows per request (matches the batch writer). */
const MAX_IMPORT_ROWS = 5_000

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Imports write to the database in bulk, so they get the same kind of
  // per-user throttle the other write routes use.
  const limiter = await rateLimit(`transactions-import:${session.user.id}`, {
    limit: 5,
    windowMs: 60_000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many imports. Please wait a minute and try again." },
      { status: 429 },
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        {
          error: `CSV is too large. Maximum size is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`,
        },
        { status: 413 },
      )
    }

    const text = await file.text()

    let rows: string[][]
    try {
      rows = parseCsv(text)
    } catch {
      // Malformed CSV (e.g. an unclosed quoted field) is a client error, not
      // an internal failure.
      return NextResponse.json(
        { error: "Could not parse the CSV file. Check that quoted fields are properly closed." },
        { status: 400 },
      )
    }

    if (rows.length > MAX_IMPORT_ROWS + 1) {
      return NextResponse.json(
        { error: `CSV has too many rows. Maximum is ${MAX_IMPORT_ROWS} transactions per import.` },
        { status: 413 },
      )
    }

    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 })
    }

    // Parse header
    const header = rows[0].map((h) => h.trim().toLowerCase())
    const typeIdx = header.indexOf("type")
    const categoryIdx = header.indexOf("category")
    const amountIdx = header.indexOf("amount")
    const descriptionIdx = header.indexOf("description")
    const dateIdx = header.indexOf("date")

    if (typeIdx === -1 || categoryIdx === -1 || amountIdx === -1 || descriptionIdx === -1) {
      return NextResponse.json({
        error: "CSV must have columns: type, category, amount, description (date optional)",
      }, { status: 400 })
    }

    type CsvTransactionType = "INCOME" | "EXPENSE"
    const validTypes: CsvTransactionType[] = ["INCOME", "EXPENSE"]
    const transactions: Array<{
      type: CsvTransactionType
      category: string
      amount: number
      description: string
      date: Date
      userId: string
    }> = []

    const errors: Array<{ line: number; error: string }> = []

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].map((c) => c.trim())

      const type = cols[typeIdx]?.toUpperCase() as CsvTransactionType | undefined
      const category = cols[categoryIdx]?.toUpperCase()
      const amount = parseFloat(cols[amountIdx])
      const description = cols[descriptionIdx]

      if (!type || !validTypes.includes(type)) {
        errors.push({ line: i + 1, error: `Invalid type "${type}". Must be INCOME or EXPENSE` })
        continue
      }
      if (!category) {
        errors.push({ line: i + 1, error: "Category is required" })
        continue
      }
      if (isNaN(amount) || amount <= 0) {
        errors.push({ line: i + 1, error: `Invalid amount "${cols[amountIdx]}"` })
        continue
      }
      if (!description) {
        errors.push({ line: i + 1, error: "Description is required" })
        continue
      }

      let date: Date
      if (dateIdx !== -1 && cols[dateIdx]) {
        date = new Date(cols[dateIdx])
        if (isNaN(date.getTime())) {
          date = new Date()
        }
      } else {
        date = new Date()
      }

      transactions.push({
        type,
        category: category.replace(/\s+/g, "_"),
        amount,
        description,
        date,
        userId: session.user.id,
      })
    }

    if (transactions.length === 0) {
      return NextResponse.json({
        error: "No valid transactions found in CSV",
        importErrors: errors,
      }, { status: 400 })
    }

    // Save in batches
    const batchSize = 100
    let imported = 0
    for (let i = 0; i < transactions.length; i += batchSize) {
      await prisma.transaction.createMany({
        data: transactions.slice(i, i + batchSize),
      })
      imported += Math.min(batchSize, transactions.length - i)
    }

    return NextResponse.json({
      imported,
      total: transactions.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported} transaction${imported !== 1 ? "s" : ""}${errors.length > 0 ? ` with ${errors.length} error${errors.length !== 1 ? "s" : ""}` : ""}`,
    })
  } catch (error) {
    console.error("CSV import error:", error)
    return NextResponse.json(
      { error: "Failed to import CSV" },
      { status: 500 }
    )
  }
}
