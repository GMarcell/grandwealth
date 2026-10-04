import { NextResponse } from "next/server"
import { requireProUser } from "@/lib/api-access"
import { fetchGoldPriceIdr } from "@/lib/prices"

export async function GET() {
  const userId = await requireProUser()
  if (userId instanceof NextResponse) return userId

  try {
    const price = await fetchGoldPriceIdr()
    return NextResponse.json(price)
  } catch (error) {
    console.error("Fetch gold price error:", error)
    return NextResponse.json(
      { error: "Failed to fetch gold price" },
      { status: 500 }
    )
  }
}
