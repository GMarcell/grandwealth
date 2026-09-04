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
}

export const SHARES_PER_LOT = 100

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function monthLabel(monthKey: string): string {
  const [, monthStr] = monthKey.split("-")
  const month = parseInt(monthStr, 10) - 1
  const year = parseInt(monthKey.slice(0, 4), 10)
  return `${MONTH_NAMES[month]} ${year}`
}

/** End of the given "YYYY-MM" month (23:59:59.999 on the last day). */
function endOfMonth(monthKey: string): Date {
  const year = parseInt(monthKey.slice(0, 4), 10)
  const month = parseInt(monthKey.slice(5, 7), 10) // 1-based
  return new Date(year, month, 0, 23, 59, 59, 999)
}

export function computeNetWorthHistory(input: WealthHistoryInput): WealthPoint[] {
  const { months = 12, endDate = new Date() } = input
  const now = new Date(endDate)

  // Month keys from oldest to newest.
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  return keys.map((key) => {
    const cutoff = endOfMonth(key)

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
      label: monthLabel(key),
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
