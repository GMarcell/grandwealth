import { describe, it, expect } from "vitest"
import { computeMonthlyBalanceChain } from "../monthly-balance"

const month = (month: string, income: number, expenses: number) => ({
  month,
  income,
  expenses,
})

describe("computeMonthlyBalanceChain", () => {
  it("carries a deficit (expenses > income) into the next month", () => {
    const chain = computeMonthlyBalanceChain([
      month("Jul 2026", 100_000, 150_000), // net -50k
      month("Aug 2026", 100_000, 30_000), // +100k − 30k − 50k carried in
    ])

    expect(chain[0].net).toBe(-50_000)
    expect(chain[0].carryIn).toBe(0)
    expect(chain[0].balance).toBe(-50_000)

    expect(chain[1].carryIn).toBe(-50_000)
    expect(chain[1].net).toBe(70_000)
    expect(chain[1].balance).toBe(20_000)
  })

  it("keeps carrying a deficit until it is paid off", () => {
    const chain = computeMonthlyBalanceChain([
      month("Jul 2026", 100_000, 150_000), // -50k
      month("Aug 2026", 100_000, 150_000), // -100k
      month("Sep 2026", 100_000, 50_000), // -50k
    ])

    expect(chain.map((e) => e.balance)).toEqual([-50_000, -100_000, -50_000])
  })

  it("carries a surplus forward the same way", () => {
    const chain = computeMonthlyBalanceChain([
      month("Jul 2026", 200_000, 50_000), // +150k
      month("Aug 2026", 100_000, 30_000), // +150k + 70k = 220k
    ])

    expect(chain[1].carryIn).toBe(150_000)
    expect(chain[1].balance).toBe(220_000)
  })

  it("starts from the opening balance", () => {
    const chain = computeMonthlyBalanceChain(
      [month("Jul 2026", 100_000, 20_000)],
      -30_000,
    )

    expect(chain[0].carryIn).toBe(-30_000)
    expect(chain[0].balance).toBe(50_000)
  })

  it("returns an empty chain for no months", () => {
    expect(computeMonthlyBalanceChain([])).toEqual([])
  })
})
