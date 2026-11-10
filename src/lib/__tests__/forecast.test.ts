import { describe, it, expect, vi } from "vitest"
import { format } from "date-fns"
import {
  forecastWindow,
  projectRecurringEvents,
  summarizeForecast,
  type ForecastEvent,
  type ForecastSchedule,
} from "@/lib/forecast"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

const NOW = new Date(2026, 10, 10, 9, 0, 0) // 10 Nov 2026, 09:00 local

const schedule = (
  overrides: Partial<ForecastSchedule> = {},
): ForecastSchedule => ({
  id: "rec_1",
  type: "EXPENSE",
  category: "HOUSING",
  description: "Rent",
  amount: 5_000_000,
  frequency: "MONTHLY",
  nextDate: new Date(2026, 10, 15, 0, 0, 0),
  endDate: null,
  ...overrides,
})

describe("forecastWindow", () => {
  it("spans today through the end of the 30th day", () => {
    const { start, end } = forecastWindow(NOW)

    expect(start).toEqual(new Date(2026, 10, 10, 0, 0, 0, 0))
    expect(end).toEqual(new Date(2026, 11, 10, 23, 59, 59, 999))
  })
})

/** Occurrence dates are ISO timestamps, so read them back in local time. */
const localDates = (events: ForecastEvent[]) =>
  events.map((e) => format(new Date(e.date), "yyyy-MM-dd"))

describe("projectRecurringEvents", () => {
  it("expands a weekly schedule into every occurrence in the window", () => {
    const events = projectRecurringEvents(
      [
        schedule({
          frequency: "WEEKLY",
          nextDate: new Date(2026, 10, 11, 0, 0, 0),
          description: "Cleaner",
        }),
      ],
      NOW,
    )

    expect(localDates(events)).toEqual([
      "2026-11-11",
      "2026-11-18",
      "2026-11-25",
      "2026-12-02",
      "2026-12-09",
    ])
  })

  it("includes an occurrence today but skips past occurrences", () => {
    const events = projectRecurringEvents(
      [
        schedule({
          frequency: "MONTHLY",
          nextDate: new Date(2026, 10, 5, 0, 0, 0), // overdue
        }),
      ],
      NOW,
    )

    // 5 Nov is behind us (cron materializes it); 5 Dec is the next one.
    expect(localDates(events)).toEqual(["2026-12-05"])
  })

  it("stops at the schedule's end date", () => {
    const events = projectRecurringEvents(
      [
        schedule({
          frequency: "WEEKLY",
          nextDate: new Date(2026, 10, 11, 0, 0, 0),
          endDate: new Date(2026, 10, 19, 0, 0, 0),
        }),
      ],
      NOW,
    )

    expect(localDates(events)).toEqual(["2026-11-11", "2026-11-18"])
  })

  it("keeps an occurrence on the window's final day and drops the next", () => {
    const events = projectRecurringEvents(
      [
        schedule({
          frequency: "MONTHLY",
          nextDate: new Date(2026, 11, 10, 0, 0, 0),
        }),
        schedule({
          id: "rec_2",
          frequency: "MONTHLY",
          nextDate: new Date(2026, 11, 11, 0, 0, 0),
        }),
      ],
      NOW,
    )

    expect(events.map((e) => e.id)).toEqual(["rec_1:2026-12-10"])
  })

  it("projects yearly schedules once", () => {
    const events = projectRecurringEvents(
      [schedule({ frequency: "YEARLY", nextDate: new Date(2026, 10, 20, 0, 0, 0) })],
      NOW,
    )

    expect(events).toHaveLength(1)
  })

  it("sorts events across schedules by date", () => {
    const events = projectRecurringEvents(
      [
        schedule({
          id: "late",
          nextDate: new Date(2026, 10, 20, 0, 0, 0),
        }),
        schedule({
          id: "early",
          type: "INCOME",
          nextDate: new Date(2026, 10, 11, 0, 0, 0),
        }),
      ],
      NOW,
    )

    expect(events.map((e) => e.recurringId)).toEqual(["early", "late"])
  })
})

describe("summarizeForecast", () => {
  const event = (overrides: Partial<ForecastEvent>): ForecastEvent => ({
    id: "e1",
    recurringId: "rec_1",
    date: new Date(2026, 10, 15).toISOString(),
    type: "EXPENSE",
    category: "HOUSING",
    description: "Rent",
    amount: 5_000_000,
    ...overrides,
  })

  it("totals income and expenses and projects the closing balance", () => {
    const summary = summarizeForecast(10_000_000, [
      event({ id: "salary", type: "INCOME", amount: 8_000_000 }),
      event({ id: "rent", amount: 5_000_000 }),
      event({ id: "food", amount: 1_000_000 }),
    ])

    expect(summary).toEqual({
      startBalance: 10_000_000,
      projectedIncome: 8_000_000,
      projectedExpenses: 6_000_000,
      netChange: 2_000_000,
      endBalance: 12_000_000,
    })
  })

  it("handles an empty projection", () => {
    expect(summarizeForecast(3_000_000, [])).toEqual({
      startBalance: 3_000_000,
      projectedIncome: 0,
      projectedExpenses: 0,
      netChange: 0,
      endBalance: 3_000_000,
    })
  })

  it("reports a negative closing balance when bills exceed cash", () => {
    const summary = summarizeForecast(1_000_000, [
      event({ amount: 4_000_000 }),
    ])

    expect(summary.endBalance).toBe(-3_000_000)
  })
})
