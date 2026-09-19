import { describe, it, expect } from "vitest"
import { computeNetWorthHistory } from "../wealth-history"

describe("computeNetWorthHistory", () => {
  it("returns the requested number of months, oldest to newest", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 6,
      endDate: new Date(2026, 6, 15), // July 2026
    })

    expect(history).toHaveLength(6)
    expect(history[0].month).toBe("2026-02")
    expect(history[5].month).toBe("2026-07")
    expect(history[5].label).toBe("Jul 2026")
  })

  it("accumulates cash from income minus expenses up to each month end", () => {
    const history = computeNetWorthHistory({
      transactions: [
        { type: "INCOME", amount: 10_000_000, date: new Date(2026, 0, 10) }, // Jan
        { type: "EXPENSE", amount: 4_000_000, date: new Date(2026, 0, 20) }, // Jan
        { type: "INCOME", amount: 10_000_000, date: new Date(2026, 1, 5) }, // Feb
      ],
      goldDeposits: [],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 3,
      endDate: new Date(2026, 2, 15), // March 2026 → series starts Jan
    })

    expect(history[0].cash).toBe(6_000_000) // after Jan
    expect(history[1].cash).toBe(16_000_000) // after Feb
    expect(history[2].cash).toBe(16_000_000) // after Mar (no new tx)
  })

  it("computes gold value from weight held × current price", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [
        { type: "BUY", weightGram: 10, totalAmount: 15_000_000, date: new Date(2026, 0, 5) },
        { type: "SELL", weightGram: 2, totalAmount: 3_200_000, date: new Date(2026, 1, 5) },
      ],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: 2_000_000, // 2jt per gram
      months: 3,
      endDate: new Date(2026, 2, 15), // March 2026 → series starts Jan
    })

    expect(history[0].gold).toBe(20_000_000) // 10g × 2jt
    expect(history[1].gold).toBe(16_000_000) // 8g × 2jt
  })

  it("falls back to cost basis for gold when no live price exists", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [
        { type: "BUY", weightGram: 10, totalAmount: 15_000_000, date: new Date(2026, 0, 5) },
      ],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 2,
      endDate: new Date(2026, 1, 15),
    })

    expect(history[0].gold).toBe(15_000_000)
  })

  it("cost-basis fallback reduces by average cost on sell, not proceeds or gross bought", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [
        { type: "BUY", weightGram: 10, totalAmount: 15_000_000, date: new Date(2026, 0, 5) }, // 1.5jt/g
        { type: "SELL", weightGram: 4, totalAmount: 6_400_000, date: new Date(2026, 1, 5) }, // sold at 1.6jt/g
      ],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 2,
      endDate: new Date(2026, 1, 15),
    })

    expect(history[0].gold).toBe(15_000_000) // before the sell
    // 6g remaining × 1.5jt/g average cost = 9jt — not 15jt (gross bought) and
    // not 8.6jt (15jt − 6.4jt proceeds).
    expect(history[1].gold).toBe(9_000_000)
  })

  it("clamps gold to zero when more is sold than held", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [
        { type: "BUY", weightGram: 5, totalAmount: 5_000_000, date: new Date(2026, 0, 5) },
        { type: "SELL", weightGram: 10, totalAmount: 12_000_000, date: new Date(2026, 1, 5) },
      ],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 2,
      endDate: new Date(2026, 1, 15),
    })

    expect(history[1].gold).toBe(0) // never negative
  })

  it("sells count only from their own date onward in each month's value", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [
        { type: "BUY", weightGram: 10, totalAmount: 10_000_000, date: new Date(2026, 0, 20) },
        { type: "SELL", weightGram: 3, totalAmount: 3_600_000, date: new Date(2026, 1, 10) },
      ],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 3,
      endDate: new Date(2026, 2, 15), // Jan → Mar
    })

    expect(history[0].gold).toBe(10_000_000) // Jan: buy only
    expect(history[1].gold).toBe(7_000_000) // Feb: after 3g sold @ 1jt/g avg cost
    expect(history[2].gold).toBe(7_000_000) // Mar: unchanged
  })

  it("values stocks with current price per lot, falling back to buy price", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [],
      stocks: [
        {
          quantity: 2,
          buyPrice: 1_000_000, // per lot
          currentPrice: 1_200, // per share → 120k per lot
          date: new Date(2026, 0, 5),
        },
      ],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 2,
      endDate: new Date(2026, 1, 15),
    })

    // 2 lots × (1.200 × 100 shares) = 240.000
    expect(history[0].stocks).toBe(240_000)
  })

  it("subtracts loan balances from total after the loan start date", () => {
    const history = computeNetWorthHistory({
      transactions: [],
      goldDeposits: [],
      stocks: [],
      bankSavings: [],
      loans: [
        { startDate: new Date(2026, 1, 1), remainingBalance: 50_000_000 }, // Feb
      ],
      goldPricePerGram: null,
      months: 2,
      endDate: new Date(2026, 1, 15),
    })

    expect(history[0].debt).toBe(0) // before the loan started
    expect(history[1].debt).toBe(50_000_000)
    expect(history[1].total).toBe(-50_000_000)
  })

  it("buckets by budget month when a start day is set", () => {
    const history = computeNetWorthHistory({
      // Aug 29 falls in the budget month that ends 27 Sep → "Sep 2026".
      transactions: [
        { type: "INCOME", amount: 5_000_000, date: new Date(2026, 7, 29) },
      ],
      goldDeposits: [],
      stocks: [],
      bankSavings: [],
      loans: [],
      goldPricePerGram: null,
      months: 2,
      endDate: new Date(2026, 8, 20), // Sep 20 → current budget month is "2026-08"
      startDay: 28,
    })

    expect(history[0].month).toBe("2026-07") // Jul 28 – Aug 27
    expect(history[0].label).toBe("Aug 2026")
    expect(history[0].cash).toBe(0) // Aug 29 is after the 27 Aug cutoff

    expect(history[1].month).toBe("2026-08") // Aug 28 – Sep 27
    expect(history[1].label).toBe("Sep 2026")
    expect(history[1].cash).toBe(5_000_000) // included here, not in "August"
  })

  it("combines all components into a total", () => {
    const history = computeNetWorthHistory({
      transactions: [{ type: "INCOME", amount: 10_000_000, date: new Date(2026, 0, 10) }],
      goldDeposits: [{ type: "BUY", weightGram: 1, totalAmount: 2_000_000, date: new Date(2026, 0, 5) }],
      stocks: [
        { quantity: 1, buyPrice: 1_000_000, currentPrice: null, date: new Date(2026, 0, 5) },
      ],
      bankSavings: [{ type: "DEPOSIT", amount: 3_000_000, date: new Date(2026, 0, 8) }],
      loans: [{ startDate: new Date(2026, 0, 1), remainingBalance: 4_000_000 }],
      goldPricePerGram: 2_000_000,
      months: 1,
      endDate: new Date(2026, 0, 15),
    })

    expect(history[0]).toMatchObject({
      cash: 10_000_000,
      gold: 2_000_000,
      stocks: 1_000_000,
      savings: 3_000_000,
      debt: 4_000_000,
      assets: 16_000_000,
      total: 12_000_000,
    })
  })
})
