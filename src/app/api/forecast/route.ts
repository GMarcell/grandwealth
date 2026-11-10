import { NextResponse } from "next/server"
import { withProUser } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import {
  FORECAST_DAYS,
  forecastWindow,
  projectRecurringEvents,
  summarizeForecast,
} from "@/lib/forecast"

/**
 * GET /api/forecast
 * Projects active recurring transactions onto the next 30 days and returns the
 * resulting income, expenses, and closing cash balance.
 *
 * Pro-only because it depends on recurring automation, which only runs for
 * entitled subscribers — a lapsed user's leftover schedules must not be
 * projected as future cash.
 */
export const GET = withProUser(GET_handler)

async function GET_handler(userId: string) {
  try {
    const now = new Date()
    const { end } = forecastWindow(now)

    const [schedules, cashByType] = await Promise.all([
      prisma.recurringTransaction.findMany({
        where: {
          userId,
          active: true,
          nextDate: { lte: end },
        },
        select: {
          id: true,
          type: true,
          category: true,
          description: true,
          amount: true,
          frequency: true,
          nextDate: true,
          endDate: true,
        },
      }),
      // Current cash position: all-time income minus expenses, the same cash
      // definition the dashboard hero and net-worth chart use.
      prisma.transaction.groupBy({
        by: ["type"],
        where: { userId, date: { lte: now } },
        _sum: { amount: true },
      }),
    ])

    const income =
      cashByType.find((row) => row.type === "INCOME")?._sum.amount ?? 0
    const expenses =
      cashByType.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0

    const events = projectRecurringEvents(schedules, now, FORECAST_DAYS)
    const summary = summarizeForecast(income - expenses, events)

    return NextResponse.json({
      windowDays: FORECAST_DAYS,
      ...summary,
      events,
    })
  } catch (error) {
    console.error("Forecast error:", error)
    return NextResponse.json(
      { error: "Failed to build cash-flow forecast" },
      { status: 500 }
    )
  }
}
