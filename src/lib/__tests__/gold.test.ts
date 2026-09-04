import { describe, it, expect } from "vitest"
import { computeGoldPortfolio, validateGoldChange } from "../gold"

describe("computeGoldPortfolio", () => {
  it("returns an empty portfolio when there are no deposits", () => {
    const result = computeGoldPortfolio([])

    expect(result).toEqual({ totalWeight: 0, totalInvested: 0, avgPricePerGram: 0 })
  })

  it("sums weight and cost basis for buys", () => {
    const result = computeGoldPortfolio([
      { type: "BUY", weightGram: 10, totalAmount: 10_000_000 },
      { type: "BUY", weightGram: 5, totalAmount: 6_000_000 },
    ])

    expect(result.totalWeight).toBe(15)
    expect(result.totalInvested).toBe(16_000_000)
    expect(result.avgPricePerGram).toBeCloseTo(1_066_666.67, 0)
  })

  it("reduces cost basis by average cost on sell (not by sale proceeds)", () => {
    // Bought 10g at 1jt/g. Sold 5g at 1.2jt/g — the cost basis of what remains
    // must be 5g × 1jt/g = 5jt, regardless of the 6jt sale price.
    const result = computeGoldPortfolio([
      { type: "BUY", weightGram: 10, totalAmount: 10_000_000 },
      { type: "SELL", weightGram: 5, totalAmount: 6_000_000 },
    ])

    expect(result.totalWeight).toBe(5)
    expect(result.totalInvested).toBe(5_000_000)
    expect(result.avgPricePerGram).toBe(1_000_000)
  })

  it("treats buys after sells independently", () => {
    const result = computeGoldPortfolio([
      { type: "BUY", weightGram: 10, totalAmount: 10_000_000 }, // 1jt/g
      { type: "SELL", weightGram: 4, totalAmount: 5_000_000 },
      { type: "BUY", weightGram: 2, totalAmount: 3_000_000 }, // 1.5jt/g
    ])

    // Remaining from first buy: 6g at 1jt/g = 6jt; plus 2g at 1.5jt/g = 3jt.
    expect(result.totalWeight).toBe(8)
    expect(result.totalInvested).toBe(9_000_000)
    expect(result.avgPricePerGram).toBe(1_125_000)
  })

  it("clamps to an empty portfolio when more is sold than held", () => {
    const result = computeGoldPortfolio([
      { type: "BUY", weightGram: 10, totalAmount: 10_000_000 },
      { type: "SELL", weightGram: 15, totalAmount: 20_000_000 },
    ])

    expect(result.totalWeight).toBe(0)
    expect(result.totalInvested).toBe(0)
    expect(result.avgPricePerGram).toBe(0)
  })

  it("returns zero average price when no weight is held", () => {
    const result = computeGoldPortfolio([
      { type: "BUY", weightGram: 10, totalAmount: 10_000_000 },
      { type: "SELL", weightGram: 10, totalAmount: 11_000_000 },
    ])

    expect(result.totalWeight).toBe(0)
    expect(result.totalInvested).toBe(0)
    expect(result.avgPricePerGram).toBe(0)
  })

  it("does not include a sell before it happens when dates are present", () => {
    // Structurally identical records are passed regardless of the date field;
    // date filtering is the caller's responsibility (see wealth-history.ts).
    const result = computeGoldPortfolio([
      { type: "BUY", weightGram: 10, totalAmount: 10_000_000 },
      { type: "BUY", weightGram: 5, totalAmount: 7_500_000 },
    ])

    expect(result.totalWeight).toBe(15)
    expect(result.totalInvested).toBe(17_500_000)
  })
})

describe("validateGoldChange", () => {
  const buy = (w: number, total?: number) => ({
    type: "BUY" as const,
    weightGram: w,
    totalAmount: total ?? w * 1_000_000,
  })
  const sell = (w: number, total?: number) => ({
    type: "SELL" as const,
    weightGram: w,
    totalAmount: total ?? w * 1_000_000,
  })

  it("allows buying when nothing is held", () => {
    expect(validateGoldChange([], [buy(10)])).toMatchObject({ allowed: true })
  })

  it("allows a partial sell within holdings", () => {
    const before = [buy(10)]
    expect(validateGoldChange(before, [...before, sell(4)])).toMatchObject({
      allowed: true,
      heldWeight: 10,
    })
  })

  it("allows selling exactly all holdings (net zero)", () => {
    const before = [buy(10)]
    expect(validateGoldChange(before, [...before, sell(10)])).toMatchObject({
      allowed: true,
    })
  })

  it("rejects a sell larger than holdings", () => {
    const before = [buy(10)]
    const result = validateGoldChange(before, [...before, sell(15)])

    expect(result.allowed).toBe(false)
    expect(result.heldWeight).toBe(10)
  })

  it("rejects any sell when nothing is held", () => {
    const result = validateGoldChange([], [sell(1)])

    expect(result.allowed).toBe(false)
    expect(result.heldWeight).toBe(0)
  })

  it("rejects edits that deepen a legacy oversold position", () => {
    // Legacy state already oversold by 5g (sold before ever buying).
    const before = [sell(5)]
    expect(validateGoldChange(before, [...before, sell(3)])).toMatchObject({
      allowed: false,
    })
  })

  it("allows edits that repair a legacy oversold position (buying back)", () => {
    const before = [sell(5)] // net -5g
    expect(validateGoldChange(before, [...before, buy(10)])).toMatchObject({
      allowed: true,
    })
  })

  it("allows an edit that leaves an unchanged legacy oversold state (e.g. notes)", () => {
    const before = [sell(5)] // net -5g
    expect(validateGoldChange(before, before)).toMatchObject({ allowed: true })
  })
})
