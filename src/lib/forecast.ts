import { addDays, format, startOfDay } from "date-fns"
import { advanceRecurringDate } from "@/lib/recurring"

/**
 * 30-day cash-flow forecast.
 *
 * Projects every active recurring schedule onto the next 30 days and turns the
 * occurrences into income/expense events. The projected closing balance is the
 * user's current cash position (all-time net cash flow) plus those events.
 *
 * Only recurring transactions are projected — one-off future-dated
 * transactions are already real records and would be double-counted.
 */

export const FORECAST_DAYS = 30

export type ForecastFrequency = "WEEKLY" | "MONTHLY" | "YEARLY"

export interface ForecastSchedule {
  id: string
  type: "INCOME" | "EXPENSE"
  category: string
  description: string
  amount: number
  frequency: ForecastFrequency
  nextDate: Date
  endDate: Date | null
}

export interface ForecastEvent {
  /** "<recurringId>:<YYYY-MM-DD>" — stable per occurrence. */
  id: string
  recurringId: string
  /** ISO timestamp of the occurrence. */
  date: string
  type: "INCOME" | "EXPENSE"
  category: string
  description: string
  amount: number
}

export interface ForecastSummary {
  startBalance: number
  projectedIncome: number
  projectedExpenses: number
  /** projectedIncome − projectedExpenses. */
  netChange: number
  /** startBalance + netChange. */
  endBalance: number
}

/**
 * Inclusive window: from the start of `now`'s day through the end of the day
 * `days` later.
 */
export function forecastWindow(now: Date, days: number = FORECAST_DAYS) {
  const start = startOfDay(now)
  const end = addDays(start, days)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/**
 * Expand recurring schedules into the individual occurrences that fall inside
 * the forecast window. Occurrences before today are skipped (today's cron run
 * materializes those); the loop is bounded so a bad `nextDate` can never hang
 * a request.
 */
export function projectRecurringEvents(
  schedules: ForecastSchedule[],
  now: Date,
  days: number = FORECAST_DAYS,
): ForecastEvent[] {
  const { start, end } = forecastWindow(now, days)
  const events: ForecastEvent[] = []

  for (const schedule of schedules) {
    let cursor = new Date(schedule.nextDate)
    let iterations = 0

    while (cursor <= end && iterations < 1000) {
      if (schedule.endDate && cursor > new Date(schedule.endDate)) break

      if (cursor >= start) {
        events.push({
          id: `${schedule.id}:${format(cursor, "yyyy-MM-dd")}`,
          recurringId: schedule.id,
          date: cursor.toISOString(),
          type: schedule.type,
          category: schedule.category,
          description: schedule.description,
          amount: schedule.amount,
        })
      }

      cursor = advanceRecurringDate(cursor, schedule.frequency)
      iterations++
    }
  }

  return events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )
}

export function summarizeForecast(
  startBalance: number,
  events: ForecastEvent[],
): ForecastSummary {
  const projectedIncome = events
    .filter((e) => e.type === "INCOME")
    .reduce((sum, e) => sum + e.amount, 0)
  const projectedExpenses = events
    .filter((e) => e.type === "EXPENSE")
    .reduce((sum, e) => sum + e.amount, 0)
  const netChange = projectedIncome - projectedExpenses

  return {
    startBalance,
    projectedIncome,
    projectedExpenses,
    netChange,
    endBalance: startBalance + netChange,
  }
}
