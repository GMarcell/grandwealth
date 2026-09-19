import { getBudgetMonthKey } from "./budget-months"

/**
 * Carry-over (rollover) computation for budgets.
 *
 * A month's unused budget — `effectiveAmount − spent` — becomes the next
 * month's incoming carry-over, so leftovers **compound** across months instead
 * of only ever looking at the immediately previous month. An optional
 * per-budget `rolloverCap` caps the amount received in a given month.
 *
 * A category with no budget in a month has its chain reset, so carry-over does
 * not jump across a gap where the user wasn't budgeting that category.
 *
 * Carry-over is purely a budgeting figure: it is never added as income or a
 * transaction, so it does not affect net wealth / cash flow.
 */

export interface CarryOverBudgetInput {
  categoryName: string
  month: string
  amount: number
  rolloverCap: number | null
}

export interface CarryOverEntry {
  categoryName: string
  month: string
  /** The budgeted amount for the month (before carry-over). */
  amount: number
  /** Expense total for the month. */
  spent: number
  /** Carry-over received into this month. */
  rollover: number
  /** amount + rollover. */
  effectiveAmount: number
  /** Unused amount carried forward to the next month (never negative). */
  unused: number
}

/**
 * Compute carry-over entries for every budget across `months` (any order — they
 * are sorted oldest → newest internally).
 */
export function computeCarryOverChain(params: {
  months: string[]
  budgets: CarryOverBudgetInput[]
  spentByMonthCategory: Map<string, Map<string, number>>
  carryOverEnabled: boolean
}): Map<string, Map<string, CarryOverEntry>> {
  const { months, budgets, spentByMonthCategory, carryOverEnabled } = params

  const budgetsByMonth = new Map<string, CarryOverBudgetInput[]>()
  for (const b of budgets) {
    const list = budgetsByMonth.get(b.month)
    if (list) list.push(b)
    else budgetsByMonth.set(b.month, [b])
  }

  const result = new Map<string, Map<string, CarryOverEntry>>()
  // Unused amount carried forward, per category, from the previous month.
  const carried = new Map<string, number>()

  for (const month of [...months].sort()) {
    const monthBudgets = budgetsByMonth.get(month) ?? []
    const entries = new Map<string, CarryOverEntry>()
    const seen = new Set<string>()

    for (const b of monthBudgets) {
      seen.add(b.categoryName)

      const prevUnused = carried.get(b.categoryName) ?? 0
      const rollover =
        carryOverEnabled && prevUnused > 0
          ? b.rolloverCap != null
            ? Math.min(prevUnused, b.rolloverCap)
            : prevUnused
          : 0

      const effectiveAmount = b.amount + rollover
      const spent = spentByMonthCategory.get(month)?.get(b.categoryName) ?? 0
      const unused = Math.max(0, effectiveAmount - spent)

      entries.set(b.categoryName, {
        categoryName: b.categoryName,
        month,
        amount: b.amount,
        spent,
        rollover,
        effectiveAmount,
        unused,
      })

      carried.set(b.categoryName, carryOverEnabled ? unused : 0)
    }

    // A month without a budget for a category breaks its carry-over chain.
    for (const category of [...carried.keys()]) {
      if (!seen.has(category)) carried.delete(category)
    }

    result.set(month, entries)
  }

  return result
}

/**
 * Build a `monthKey → category → expense total` map from transactions, bucketed
 * by the user's budget month.
 */
export function buildSpentByMonthCategory(
  transactions: Array<{ type: string; category: string; amount: number; date: Date | string }>,
  startDay: number,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()

  for (const tx of transactions) {
    if (tx.type !== "EXPENSE") continue
    const monthKey = getBudgetMonthKey(new Date(tx.date), startDay)
    const categoryMap = result.get(monthKey)
    if (categoryMap) {
      categoryMap.set(tx.category, (categoryMap.get(tx.category) ?? 0) + tx.amount)
    } else {
      result.set(monthKey, new Map([[tx.category, tx.amount]]))
    }
  }

  return result
}
