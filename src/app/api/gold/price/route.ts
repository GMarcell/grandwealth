import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProAccess } from "@/lib/api-access"
import { fetchGoldPriceIdr } from "@/lib/prices"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const proAccess = await requireProAccess(session.user.id)
  if (proAccess instanceof NextResponse) return proAccess

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
