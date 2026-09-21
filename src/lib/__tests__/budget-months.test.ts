import { describe, it, expect, vi, afterEach } from "vitest"
import {
  getBudgetMonthKey,
  getCurrentBudgetMonthKey,
  getPreviousBudgetMonthKey,
  getBudgetMonthRange,
  generateBudgetMonths,
  getBudgetMonthLabel,
  getLastCompletedBudgetMonthKey,
  generateCompletedBudgetMonths,
} from "../budget-months"

// Helper to create a date with no time component for consistent comparisons
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

describe("getBudgetMonthKey", () => {
  it("returns the current month key when day >= startDay", () => {
    // July 20 with startDay=15 → "2026-07" (July)
    expect(getBudgetMonthKey(d(2026, 7, 20), 15)).toBe("2026-07")
  })

  it("returns the previous month key when day < startDay", () => {
    // July 10 with startDay=15 → "2026-06" (June)
    expect(getBudgetMonthKey(d(2026, 7, 10), 15)).toBe("2026-06")
  })

  it("uses the default startDay of 1 correctly", () => {
    // With startDay=1, any day is >= 1, so it always returns the current month
    expect(getBudgetMonthKey(d(2026, 7, 1), 1)).toBe("2026-07")
    expect(getBudgetMonthKey(d(2026, 7, 31), 1)).toBe("2026-07")
  })

  it("works on the exact start day boundary", () => {
    // July 15 with startDay=15 → day(15) >= startDay(15) → current month
    expect(getBudgetMonthKey(d(2026, 7, 15), 15)).toBe("2026-07")
  })

  it("works across year boundaries", () => {
    // January 5 with startDay=15 → day(5) < startDay(15) → previous month (December)
    expect(getBudgetMonthKey(d(2027, 1, 5), 15)).toBe("2026-12")
  })

  it("handles startDay of 28", () => {
    // March 27 with startDay=28 → day(27) < startDay(28) → February
    expect(getBudgetMonthKey(d(2026, 3, 27), 28)).toBe("2026-02")
    // March 29 with startDay=28 → day(29) >= startDay(28) → March
    expect(getBudgetMonthKey(d(2026, 3, 29), 28)).toBe("2026-03")
  })

  it("pads month numbers to 2 digits", () => {
    // January → "01"
    expect(getBudgetMonthKey(d(2026, 1, 15), 1)).toBe("2026-01")
    // September → "09"
    expect(getBudgetMonthKey(d(2026, 9, 15), 1)).toBe("2026-09")
  })
})

describe("getCurrentBudgetMonthKey", () => {
  it("returns today's budget month key", () => {
    const today = new Date()
    const expected = getBudgetMonthKey(today, 15)
    expect(getCurrentBudgetMonthKey(15)).toBe(expected)
  })

  it("accepts different startDay values", () => {
    const today = new Date()
    expect(getCurrentBudgetMonthKey(1)).toBe(getBudgetMonthKey(today, 1))
    expect(getCurrentBudgetMonthKey(15)).toBe(getBudgetMonthKey(today, 15))
  })
})

describe("getPreviousBudgetMonthKey", () => {
  it("returns the previous budget month", () => {
    // "2026-08" with startDay=15 → "2026-07"
    expect(getPreviousBudgetMonthKey("2026-08", 15)).toBe("2026-07")
  })

  it("works with default startDay of 1", () => {
    expect(getPreviousBudgetMonthKey("2026-08", 1)).toBe("2026-07")
  })

  it("handles year boundaries", () => {
    // January with startDay=15 → December of previous year
    expect(getPreviousBudgetMonthKey("2027-01", 15)).toBe("2026-12")
  })
})

describe("getBudgetMonthRange", () => {
  it("returns correct range for startDay=15", () => {
    const { start, end } = getBudgetMonthRange("2026-07", 15)
    expect(start).toEqual(d(2026, 7, 15))
    expect(end).toEqual(d(2026, 8, 14))
  })

  it("returns correct range for startDay=1 (calendar month)", () => {
    const { start, end } = getBudgetMonthRange("2026-07", 1)
    expect(start).toEqual(d(2026, 7, 1))
    expect(end).toEqual(d(2026, 7, 31))
  })

  it("handles the end of year correctly", () => {
    const { start, end } = getBudgetMonthRange("2026-12", 15)
    expect(start).toEqual(d(2026, 12, 15))
    expect(end).toEqual(d(2027, 1, 14))
  })

  it("handles February with startDay=28", () => {
    // January month with startDay=28
    const { start, end } = getBudgetMonthRange("2026-01", 28)
    expect(start).toEqual(d(2026, 1, 28))
    expect(end).toEqual(d(2026, 2, 27))
  })
})

describe("generateBudgetMonths", () => {
  it("returns the correct number of months", () => {
    const months = generateBudgetMonths(12, 1)
    expect(months).toHaveLength(12)
  })

  it("returns unique month keys for startDay=1", () => {
    const months = generateBudgetMonths(12, 1)
    const unique = new Set(months)
    expect(unique.size).toBe(12)
  })

  it("returns the current month as the first entry", () => {
    const months = generateBudgetMonths(1, 1)
    const currentKey = getCurrentBudgetMonthKey(1)
    expect(months[0]).toBe(currentKey)
  })

  it("starts at the current budget month for a mid-month cycle", () => {
    const months = generateBudgetMonths(12, 28)
    expect(months[0]).toBe(getCurrentBudgetMonthKey(28))
    expect(new Set(months).size).toBe(12)
    for (let i = 0; i < months.length - 1; i++) {
      expect(months[i].localeCompare(months[i + 1])).toBeGreaterThan(0)
    }
  })

  it("returns months in descending order", () => {
    const months = generateBudgetMonths(6, 1)
    for (let i = 0; i < months.length - 1; i++) {
      expect(months[i].localeCompare(months[i + 1])).toBeGreaterThan(0)
    }
  })
})

describe("getLastCompletedBudgetMonthKey", () => {
  afterEach(() => vi.useRealTimers())

  it("returns the budget month before the one currently running", () => {
    vi.useFakeTimers()
    // 20 Sep sits inside 15 Sep – 14 Oct (key "2026-09").
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))
    // The last fully-ended period is 15 Aug – 14 Sep (key "2026-08").
    expect(getLastCompletedBudgetMonthKey(15)).toBe("2026-08")
  })

  it("returns the previous calendar month when startDay is 1", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))
    expect(getLastCompletedBudgetMonthKey(1)).toBe("2026-08")
  })

  it("handles a 28th cycle whose running period starts in the previous month", () => {
    vi.useFakeTimers()
    // 20 Sep is inside 28 Aug – 27 Sep (key "2026-08"), so the last completed
    // period is 28 Jul – 27 Aug (key "2026-07").
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))
    expect(getLastCompletedBudgetMonthKey(28)).toBe("2026-07")
  })
})

describe("generateCompletedBudgetMonths", () => {
  afterEach(() => vi.useRealTimers())

  it("starts at the last completed month and never offers the running one", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0))

    const months = generateCompletedBudgetMonths(3, 15)
    expect(months).toEqual(["2026-08", "2026-07", "2026-06"])
    // The in-progress "2026-09" budget month is not offered.
    expect(months).not.toContain(getCurrentBudgetMonthKey(15))
  })
})

describe("getBudgetMonthLabel", () => {
  it("returns a calendar month label when startDay is 1", () => {
    expect(getBudgetMonthLabel("2026-07", 1)).toBe("Jul 2026")
    expect(getBudgetMonthLabel("2026-01", 1)).toBe("Jan 2026")
    expect(getBudgetMonthLabel("2026-12", 1)).toBe("Dec 2026")
  })

  it("names a budget month after the calendar month it ends in", () => {
    // Key "2026-08" with startDay=28 covers 28 Aug – 27 Sep, so it is September.
    expect(getBudgetMonthLabel("2026-08", 28)).toBe("Sep 2026")
    expect(getBudgetMonthLabel("2026-07", 28)).toBe("Aug 2026")
    // Key "2026-07" with startDay=15 covers 15 Jul – 14 Aug, so it is August.
    expect(getBudgetMonthLabel("2026-07", 15)).toBe("Aug 2026")
  })

  it("names every start day from 2 to 28 after the ending month", () => {
    // Any startDay > 1 runs from `startDay` of the key month to `startDay - 1`
    // of the next, so the label is always the following calendar month.
    for (let startDay = 2; startDay <= 28; startDay++) {
      expect(getBudgetMonthLabel("2026-06", startDay)).toBe("Jul 2026")
      expect(getBudgetMonthLabel("2026-01", startDay)).toBe("Feb 2026")
    }
  })

  it("labels a 28th cycle so September covers late August", () => {
    expect(getBudgetMonthLabel("2026-02", 28)).toBe("Mar 2026")
    expect(getBudgetMonthLabel("2026-08", 28)).toBe("Sep 2026")
  })

  it("pads single-digit months and keeps the year", () => {
    expect(getBudgetMonthLabel("2026-01", 28)).toBe("Feb 2026")
    expect(getBudgetMonthLabel("2026-09", 15)).toBe("Oct 2026")
  })

  it("rolls the label into the next year when needed", () => {
    // 15 Dec – 14 Jan belongs to January of the following year.
    expect(getBudgetMonthLabel("2026-12", 15)).toBe("Jan 2027")
    // 28 Dec – 27 Jan also belongs to January.
    expect(getBudgetMonthLabel("2026-12", 28)).toBe("Jan 2027")
    expect(getBudgetMonthLabel("2026-11", 15)).toBe("Dec 2026")
    expect(getBudgetMonthLabel("2027-01", 28)).toBe("Feb 2027")
  })

  it("includes date range when showRange is true and startDay > 1", () => {
    const label = getBudgetMonthLabel("2026-07", 15, true)
    expect(label).toContain("Aug 2026")
    expect(label).toContain("15 Jul")
    expect(label).toContain("14 Aug")
  })

  it("shows the full range for a 28th cycle", () => {
    expect(getBudgetMonthLabel("2026-08", 28, true)).toBe(
      "Sep 2026 (28 Aug - 27 Sep 2026)"
    )
  })

  it("shows a range that crosses the year boundary", () => {
    expect(getBudgetMonthLabel("2026-12", 15, true)).toBe(
      "Jan 2027 (15 Dec - 14 Jan 2027)"
    )
  })

  it("does not show range when startDay is 1 even if showRange is true", () => {
    const label = getBudgetMonthLabel("2026-07", 1, true)
    expect(label).toBe("Jul 2026")
  })
})
