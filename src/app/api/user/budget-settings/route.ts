import { NextResponse } from "next/server"
import { withUser } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

const DEFAULTS = {
  budgetStartDay: 1,
  carryOverEnabled: true,
  carryDeficitEnabled: true,
}

export const GET = withUser(GET_handler)

async function GET_handler(userId: string) {

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { budgetStartDay: true, carryOverEnabled: true, carryDeficitEnabled: true },
  })

  return NextResponse.json({
    budgetStartDay: user?.budgetStartDay ?? DEFAULTS.budgetStartDay,
    carryOverEnabled: user?.carryOverEnabled ?? DEFAULTS.carryOverEnabled,
    carryDeficitEnabled: user?.carryDeficitEnabled ?? DEFAULTS.carryDeficitEnabled,
  })
}

export const PATCH = withUser(PATCH_handler)

async function PATCH_handler(userId: string, req: Request) {

  try {
    const body = await req.json()
    const { budgetStartDay, carryOverEnabled, carryDeficitEnabled } = body ?? {}

    const data: {
      budgetStartDay?: number
      carryOverEnabled?: boolean
      carryDeficitEnabled?: boolean
    } = {}

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

    if (carryDeficitEnabled !== undefined) {
      if (typeof carryDeficitEnabled !== "boolean") {
        return NextResponse.json(
          { error: "carryDeficitEnabled must be a boolean" },
          { status: 400 }
        )
      }
      data.carryDeficitEnabled = carryDeficitEnabled
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No supported settings provided" },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { budgetStartDay: true, carryOverEnabled: true, carryDeficitEnabled: true },
    })

    return NextResponse.json({
      budgetStartDay: updated.budgetStartDay,
      carryOverEnabled: updated.carryOverEnabled,
      carryDeficitEnabled: updated.carryDeficitEnabled,
    })
  } catch (error) {
    console.error("Update budget settings error:", error)
    return NextResponse.json(
      { error: "Failed to update budget settings" },
      { status: 500 }
    )
  }
}
