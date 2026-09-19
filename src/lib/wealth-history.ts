/**
 * Historical net-worth computation.
 *
 * Reconstructs a month-by-month net-worth series from the user's raw records.
 * Because GrandWealth does not store daily wealth snapshots, each month's value
 * is derived from the records that existed up to the end of that month:
 *
 *   - cash    = cumulative (income - expenses) up to month end
 *   - gold    = weight held at month end × current price/gram
 *               (falls back to the cost basis of holdings when no live price
 *               is available — see computeGoldPortfolio in ./gold)
 *   - stocks  = holdings at month end × (current price or buy price, per lot)
 *   - savings = cumulative bank deposits - withdrawals
 *   - debt    = sum of remaining loan balances for loans started by month end
 *
 *   net worth = cash + gold + stocks + savings - debt
 */

import { computeGoldPortfolio } from "./gold"
import {
  getBudgetMonthKey,
  getBudgetMonthLabel,
  getBudgetMonthRange,
  getPreviousBudgetMonthKey,
} from "./budget-months"

export type TransactionLike = {
  type: "INCOME" | "EXPENSE"
  amount: number
  date: Date
}

export type GoldDepositLike = {
  type: "BUY" | "SELL"
  weightGram: number
  totalAmount: number
  date: Date
}

export type StockLike = {
  quantity: number
  buyPrice: number
  currentPrice: number | null
  date: Date
}

export type BankSavingLike = {
  type: "DEPOSIT" | "WITHDRAWAL"
  amount: number
  date: Date
}

export type LoanLike = {
  startDate: Date
  remainingBalance: number
}

export interface WealthPoint {
  month: string // "YYYY-MM"
  label: string // "Jan 2026"
  cash: number
  gold: number
  stocks: number
  savings: number
  debt: number
  assets: number
  total: number
}

export interface WealthHistoryInput {
  transactions: TransactionLike[]
  goldDeposits: GoldDepositLike[]
  stocks: StockLike[]
  bankSavings: BankSavingLike[]
  loans: LoanLike[]
  /** Current live gold price in IDR/gram. Falls back to cost basis when null. */
  goldPricePerGram: number | null
  /** Number of months to include. Defaults to 12. */
  months?: number
  /** Reference "now" date for the series end. Defaults to the current date. */
  endDate?: Date
  /**
   * Day the budget month starts (1-28). Defaults to 1 (calendar months). When
   * set, each point's cutoff is the END of that budget month period, so the
   * series lines up with budgets, the dashboard, and the transactions page.
   */
  startDay?: number
}

export const SHARES_PER_LOT = 100

export function computeNetWorthHistory(input: WealthHistoryInput): WealthPoint[] {
  const { months = 12, endDate = new Date(), startDay = 1 } = input
  const now = new Date(endDate)

  // Budget month keys from oldest to newest, ending with the budget month that
  // contains `endDate` (a plain calendar month when startDay is 1).
  const keys: string[] = []
  let key = getBudgetMonthKey(now, startDay)
  for (let i = 0; i < months; i++) {
    keys.unshift(key)
    key = getPreviousBudgetMonthKey(key, startDay)
  }

  return keys.map((key) => {
    // Cumulative values are taken up to the last day of the budget month period
    // (e.g. 27 Sep for a 28 Aug – 27 Sep budget month).
    const period = getBudgetMonthRange(key, startDay)
    const cutoff = new Date(period.end)
    cutoff.setHours(23, 59, 59, 999)

    let cash = 0
    for (const tx of input.transactions) {
      if (tx.date <= cutoff) {
        cash += tx.type === "INCOME" ? tx.amount : -tx.amount
      }
    }

    // Reuse the shared gold accounting helper so month-end holdings (weight
    // and cost basis) follow the exact same BUY/SELL rules as the gold page,
    // dashboard, and AI analysis. Filtering by cutoff date also makes sells
    // count only from their own date onward.
    const depositsUpTo = input.goldDeposits.filter((g) => g.date <= cutoff)
    const { totalWeight: goldWeight, totalInvested: goldCost } =
      computeGoldPortfolio(depositsUpTo)

    let stocksValue = 0
    for (const s of input.stocks) {
      if (s.date > cutoff) continue
      stocksValue +=
        s.quantity *
        (s.currentPrice != null ? s.currentPrice * SHARES_PER_LOT : s.buyPrice)
    }

    let savings = 0
    for (const b of input.bankSavings) {
      if (b.date > cutoff) continue
      savings += b.type === "DEPOSIT" ? b.amount : -b.amount
    }

    let debt = 0
    for (const l of input.loans) {
      if (l.startDate <= cutoff) debt += l.remainingBalance
    }

    const goldValue =
      input.goldPricePerGram != null
        ? goldWeight * input.goldPricePerGram
        : goldCost

    const assets = cash + goldValue + stocksValue + savings
    const total = assets - debt

    return {
      month: key,
      label: getBudgetMonthLabel(key, startDay),
      cash,
      gold: goldValue,
      stocks: stocksValue,
      savings,
      debt,
      assets,
      total,
    }
  })
}
