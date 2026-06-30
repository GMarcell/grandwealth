import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { budgetStartDay: true },
  })

  return NextResponse.json({ budgetStartDay: user?.budgetStartDay ?? 1 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { budgetStartDay } = await req.json()

    if (budgetStartDay == null || budgetStartDay < 1 || budgetStartDay > 28) {
      return NextResponse.json(
        { error: "budgetStartDay must be between 1 and 28" },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { budgetStartDay },
      select: { budgetStartDay: true },
    })

    return NextResponse.json({ budgetStartDay: updated.budgetStartDay })
  } catch (error) {
    console.error("Update budget settings error:", error)
    return NextResponse.json(
      { error: "Failed to update budget settings" },
      { status: 500 }
    )
  }
}
