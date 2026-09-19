import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULTS = { budgetStartDay: 1, carryOverEnabled: true }

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { budgetStartDay: true, carryOverEnabled: true },
  })

  return NextResponse.json({
    budgetStartDay: user?.budgetStartDay ?? DEFAULTS.budgetStartDay,
    carryOverEnabled: user?.carryOverEnabled ?? DEFAULTS.carryOverEnabled,
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { budgetStartDay, carryOverEnabled } = body ?? {}

    const data: { budgetStartDay?: number; carryOverEnabled?: boolean } = {}

    if (budgetStartDay !== undefined) {
      if (
        budgetStartDay == null ||
        typeof budgetStartDay !== "number" ||
        budgetStartDay < 1 ||
        budgetStartDay > 28
      ) {
        return NextResponse.json(
          { error: "budgetStartDay must be between 1 and 28" },
          { status: 400 }
        )
      }
      data.budgetStartDay = budgetStartDay
    }

    if (carryOverEnabled !== undefined) {
      if (typeof carryOverEnabled !== "boolean") {
        return NextResponse.json(
          { error: "carryOverEnabled must be a boolean" },
          { status: 400 }
        )
      }
      data.carryOverEnabled = carryOverEnabled
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No supported settings provided" },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { budgetStartDay: true, carryOverEnabled: true },
    })

    return NextResponse.json({
      budgetStartDay: updated.budgetStartDay,
      carryOverEnabled: updated.carryOverEnabled,
    })
  } catch (error) {
    console.error("Update budget settings error:", error)
    return NextResponse.json(
      { error: "Failed to update budget settings" },
      { status: 500 }
    )
  }
}
