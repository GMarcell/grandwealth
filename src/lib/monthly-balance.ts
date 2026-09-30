/**
 * Month-over-month balance carry-over.
 *
 * Unlike the per-category budget carry-over (`budget-carry-over.ts`), this
 * tracks the user's OVERALL monthly balance: each month's net
 * (income − expenses) is added to whatever was carried in from the previous
 * month, and the result is carried into the next month.
 *
 * Both directions carry by default:
 *   - a month where expenses exceed income produces a NEGATIVE carry-over
 *     (a deficit) that reduces the next month's starting balance, and
 *   - a surplus carries forward the same way.
 *
 * `carryDeficitEnabled: false` turns the first rule off (a user setting): only
 * surpluses carry, so a deficit never reduces the following month — the
 * carried balance floors at 0 going into the next month.
 *
 * The `openingBalance` is what the first month starts with (e.g. the user's net
 * cash flow before the displayed window). It defaults to 0.
 *
 * The input is processed in the order given, so callers must pass the points
 * oldest → newest.
 */

export interface MonthlyBalancePoint {
  month: string
  income: number
  expenses: number
}

export interface MonthlyBalanceEntry extends MonthlyBalancePoint {
  /** income − expenses for the month. */
  net: number
  /** Balance carried in from the previous month (negative for a deficit). */
  carryIn: number
  /** carryIn + net — the balance carried into the next month. */
  balance: number
}

/**
 * Compute the carried balance for each month, oldest → newest. A negative
 * result means the running balance is in deficit and carries into the next
 * month (unless `carryDeficitEnabled` is false — see above).
 */
export function computeMonthlyBalanceChain(
  points: MonthlyBalancePoint[],
  openingBalance = 0,
  carryDeficitEnabled = true,
): MonthlyBalanceEntry[] {
  let carried = openingBalance

  return points.map((point) => {
    const net = point.income - point.expenses
    const carryIn = carried
    const balance = carryIn + net
    // With deficit carry-off, a negative running balance is not handed to the
    // next month — the next month starts fresh (from 0) instead. The current
    // month still REPORTS its negative balance so the UI can show it.
    carried = carryDeficitEnabled ? balance : Math.max(0, balance)

    return { ...point, net, carryIn, balance }
  })
}
