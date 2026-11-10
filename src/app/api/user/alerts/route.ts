import { NextResponse } from "next/server"
import { withUser } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { ALERT_DEFAULTS } from "@/lib/alerts"

/**
 * Daily email alert preferences.
 *
 * `alertsEnabled` is opt-in (default false): the daily-alerts cron only looks
 * at users who turned it on.
 */

export const GET = withUser(GET_handler)

async function GET_handler(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      alertsEnabled: true,
      billReminderDays: true,
      budgetAlertThreshold: true,
    },
  })

  return NextResponse.json({
    alertsEnabled: user?.alertsEnabled ?? false,
    billReminderDays: user?.billReminderDays ?? ALERT_DEFAULTS.billReminderDays,
    budgetAlertThreshold:
      user?.budgetAlertThreshold ?? ALERT_DEFAULTS.budgetAlertThreshold,
  })
}

export const PATCH = withUser(PATCH_handler)

async function PATCH_handler(userId: string, req: Request) {
  try {
    const body = await req.json()
    const { alertsEnabled, billReminderDays, budgetAlertThreshold } = body ?? {}

    const data: {
      alertsEnabled?: boolean
      billReminderDays?: number
      budgetAlertThreshold?: number
    } = {}

    if (alertsEnabled !== undefined) {
      if (typeof alertsEnabled !== "boolean") {
        return NextResponse.json(
          { error: "alertsEnabled must be a boolean" },
          { status: 400 }
        )
      }
      data.alertsEnabled = alertsEnabled
    }

    if (billReminderDays !== undefined) {
      if (
        typeof billReminderDays !== "number" ||
        !Number.isInteger(billReminderDays) ||
        billReminderDays < 1 ||
        billReminderDays > 14
      ) {
        return NextResponse.json(
          { error: "billReminderDays must be an integer between 1 and 14" },
          { status: 400 }
        )
      }
      data.billReminderDays = billReminderDays
    }

    if (budgetAlertThreshold !== undefined) {
      if (
        typeof budgetAlertThreshold !== "number" ||
        !Number.isInteger(budgetAlertThreshold) ||
        budgetAlertThreshold < 50 ||
        budgetAlertThreshold > 100
      ) {
        return NextResponse.json(
          { error: "budgetAlertThreshold must be an integer between 50 and 100" },
          { status: 400 }
        )
      }
      data.budgetAlertThreshold = budgetAlertThreshold
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
      select: {
        alertsEnabled: true,
        billReminderDays: true,
        budgetAlertThreshold: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update alert settings error:", error)
    return NextResponse.json(
      { error: "Failed to update alert settings" },
      { status: 500 }
    )
  }
}
