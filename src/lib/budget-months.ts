/**
 * Budget month helper functions.
 *
 * Budget months can start on any day (1-28) instead of the default 1st.
 * For example, with startDay=15:
 *   - Budget month "2026-07" runs from July 15 to August 14
 *   - A transaction on August 10 belongs to budget month "2026-07" (day 10 < 15)
 *   - A transaction on August 20 belongs to budget month "2026-08" (day 20 >= 15)
 */

/**
 * Get the budget month key for a given date and start day.
 * Returns "YYYY-MM" where MM is the month index that contains the startDay.
 */
export function getBudgetMonthKey(date: Date, startDay: number): string {
  const year = date.getFullYear()
  const month = date.getMonth() // 0-indexed
  const day = date.getDate()

  if (day < startDay) {
    // Belongs to the previous budget month
    const prevMonth = new Date(year, month - 1, 1)
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`
  } else {
    return `${year}-${String(month + 1).padStart(2, "0")}`
  }
}

/**
 * Get the current budget month key based on today's date.
 */
export function getCurrentBudgetMonthKey(startDay: number): string {
  return getBudgetMonthKey(new Date(), startDay)
}

/**
 * Get the previous budget month key relative to the given month key.
 */
export function getPreviousBudgetMonthKey(monthKey: string, startDay: number): string {
  const [yearStr, monthStr] = monthKey.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // 0-indexed

  // The previous budget month starts `startDay` days before this month's startDay
  // In terms of calendar months, we go back one calendar month
  const prevMonth = new Date(year, month - 1, startDay)
  return getBudgetMonthKey(prevMonth, startDay)
}

/**
 * Get the start and end dates for a budget month period.
 * For monthKey "2026-07" with startDay=15:
 *   start = July 15, 2026
 *   end   = August 14, 2026 (inclusive)
 */
export function getBudgetMonthRange(monthKey: string, startDay: number): { start: Date; end: Date } {
  const [yearStr, monthStr] = monthKey.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1 // 0-indexed

  const start = new Date(year, month, startDay)
  // End is the day before the next period's start
  const end = new Date(year, month + 1, startDay - 1)

  return { start, end }
}

/**
 * Generate an array of budget month keys going back from the current month.
 * Similar to MONTHS in budgets/page.tsx but using budget month logic.
 */
export function generateBudgetMonths(count: number, startDay: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, startDay)
    months.push(getBudgetMonthKey(d, startDay))
  }
  return months
}

/**
 * Get a human-readable label for a budget month, optionally showing the date range.
 */
export function getBudgetMonthLabel(monthKey: string, startDay: number, showRange?: boolean): string {
  const [yearStr, monthStr] = monthKey.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]

  if (showRange && startDay > 1) {
    const { start, end } = getBudgetMonthRange(monthKey, startDay)
    const startMonth = monthNames[start.getMonth()]
    const endMonth = monthNames[end.getMonth()]
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()
    return `${monthNames[month]} ${year} (${startDay} ${startMonth} - ${startDay - 1} ${endMonth} ${endYear})`
  }

  return `${monthNames[month]} ${year}`
}
