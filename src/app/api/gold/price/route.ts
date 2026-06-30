import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchGoldPriceIdr } from "@/lib/prices"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
