import { NextResponse } from "next/server"
import { withProUser } from "@/lib/api-handler"
import { fetchGoldPriceIdr } from "@/lib/prices"

export const GET = withProUser(GET_handler)

async function GET_handler() {

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
