import { describe, it, expect } from "vitest"
import { advanceRecurringDate } from "../recurring"

describe("advanceRecurringDate", () => {
  it("advances weekly by 7 days", () => {
    const next = advanceRecurringDate(new Date(2026, 0, 5), "WEEKLY")
    expect(next.toISOString()).toBe(new Date(2026, 0, 12).toISOString())
  })

  it("advances monthly by one month", () => {
    const next = advanceRecurringDate(new Date(2026, 0, 15), "MONTHLY")
    expect(next.toISOString()).toBe(new Date(2026, 1, 15).toISOString())
  })

  it("advances yearly by one year", () => {
    const next = advanceRecurringDate(new Date(2026, 2, 10), "YEARLY")
    expect(next.toISOString()).toBe(new Date(2027, 2, 10).toISOString())
  })

  it("handles month-end overflow for monthly frequency (Jan 31 → Mar 2 in non-leap years is avoided by date-fns semantics; JS Date overflows)", () => {
    // JS Date.setMonth overflows: Jan 31 + 1 month = Mar 3 (Feb 31 doesn't exist).
    const next = advanceRecurringDate(new Date(2026, 0, 31), "MONTHLY")
    expect(next.getMonth()).toBe(2) // March
  })
})
