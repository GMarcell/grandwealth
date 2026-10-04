import { NextResponse } from "next/server"
import { requireUser } from "@/lib/api-access"
import { prisma } from "@/lib/prisma"
import { escapeCsvField } from "@/lib/csv"

/** Rows fetched from the database per batch. */
const BATCH_SIZE = 1_000

/**
 * Stream the signed-in user's transactions as a CSV download.
 *
 * The export is streamed and paged rather than loaded into memory in one
 * `findMany`, so a long transaction history can't exhaust the serverless
 * function's memory or time budget. Only the exported columns are selected.
 */
export async function GET() {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode("type,category,amount,description,date\n"))

        let skip = 0
        for (;;) {
          const transactions = await prisma.transaction.findMany({
            where: { userId },
            // Deterministic paging: stable tie-break on id.
            orderBy: [{ date: "desc" }, { id: "desc" }],
            skip,
            take: BATCH_SIZE,
            select: {
              type: true,
              category: true,
              amount: true,
              description: true,
              date: true,
            },
          })

          if (transactions.length === 0) break

          const chunk = transactions
            .map((tx) => {
              const date = tx.date.toISOString().split("T")[0]
              return [tx.type, tx.category, tx.amount, tx.description, date]
                .map(escapeCsvField)
                .join(",")
            })
            .join("\n")

          controller.enqueue(encoder.encode(`${chunk}\n`))

          if (transactions.length < BATCH_SIZE) break
          skip += BATCH_SIZE
        }

        controller.close()
      } catch (error) {
        console.error("CSV export error:", error)
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="transactions-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
