import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    })

    const header = "type,category,amount,description,date"
    const rows = transactions.map((tx) => {
      const date = tx.date.toISOString().split("T")[0]
      // Escape commas in description
      const desc = tx.description.includes(",") ? `"${tx.description}"` : tx.description
      return `${tx.type},${tx.category},${tx.amount},${desc},${date}`
    })

    const csv = [header, ...rows].join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="transactions-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("CSV export error:", error)
    return NextResponse.json(
      { error: "Failed to export transactions" },
      { status: 500 }
    )
  }
}
