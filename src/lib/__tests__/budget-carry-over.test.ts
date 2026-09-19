import { describe, it, expect } from "vitest"
import {
  computeCarryOverChain,
  buildSpentByMonthCategory,
  type CarryOverBudgetInput,
} from "../budget-carry-over"

const budget = (
  categoryName: string,
  amount: number,
  month: string,
  rolloverCap: number | null = null,
): CarryOverBudgetInput => ({ categoryName, amount, month, rolloverCap })

const SPENT_NONE = new Map<string, Map<string, number>>()

describe("computeCarryOverChain", () => {
  it("compounds unused budget month over month", () => {
    const chain = computeCarryOverChain({
      months: ["2026-07", "2026-08", "2026-09"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        budget("FOOD", 100_000, "2026-08"),
        budget("FOOD", 100_000, "2026-09"),
      ],
      spentByMonthCategory: SPENT_NONE,
      carryOverEnabled: true,
    })

    // Jul: 100k unused
    expect(chain.get("2026-07")!.get("FOOD")!.rollover).toBe(0)
    expect(chain.get("2026-07")!.get("FOOD")!.unused).toBe(100_000)

    // Aug: 100k + 100k rollover = 200k effective, unused 200k
    expect(chain.get("2026-08")!.get("FOOD")!.rollover).toBe(100_000)
    expect(chain.get("2026-08")!.get("FOOD")!.effectiveAmount).toBe(200_000)
    expect(chain.get("2026-08")!.get("FOOD")!.unused).toBe(200_000)

    // Sep: 100k + 200k rollover = 300k effective
    expect(chain.get("2026-09")!.get("FOOD")!.rollover).toBe(200_000)
    expect(chain.get("2026-09")!.get("FOOD")!.effectiveAmount).toBe(300_000)
  })

  it("counts spend against the effective amount each month", () => {
    const spent = new Map([
      ["2026-08", new Map([["FOOD", 50_000]])],
    ])

    const chain = computeCarryOverChain({
      months: ["2026-07", "2026-08", "2026-09"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        budget("FOOD", 100_000, "2026-08"),
        budget("FOOD", 100_000, "2026-09"),
      ],
      spentByMonthCategory: spent,
      carryOverEnabled: true,
    })

    // Aug: effective 200k, spent 50k → 150k unused
    expect(chain.get("2026-08")!.get("FOOD")!.spent).toBe(50_000)
    expect(chain.get("2026-08")!.get("FOOD")!.unused).toBe(150_000)

    // Sep: 100k + 150k
    expect(chain.get("2026-09")!.get("FOOD")!.effectiveAmount).toBe(250_000)
  })

  it("caps the carry-over received in a month", () => {
    const chain = computeCarryOverChain({
      months: ["2026-07", "2026-08"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        budget("FOOD", 100_000, "2026-08", 30_000), // cap 30k
      ],
      spentByMonthCategory: SPENT_NONE,
      carryOverEnabled: true,
    })

    // Jul's 100k unused is capped to 30k when received in Aug.
    expect(chain.get("2026-08")!.get("FOOD")!.rollover).toBe(30_000)
    expect(chain.get("2026-08")!.get("FOOD")!.effectiveAmount).toBe(130_000)
  })

  it("resets the chain when a category has no budget in a month", () => {
    const chain = computeCarryOverChain({
      months: ["2026-07", "2026-08", "2026-09"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        // No August budget → chain resets.
        budget("FOOD", 100_000, "2026-09"),
      ],
      spentByMonthCategory: SPENT_NONE,
      carryOverEnabled: true,
    })

    expect(chain.get("2026-09")!.get("FOOD")!.rollover).toBe(0)
    expect(chain.get("2026-09")!.get("FOOD")!.effectiveAmount).toBe(100_000)
  })

  it("does not carry over when disabled", () => {
    const chain = computeCarryOverChain({
      months: ["2026-07", "2026-08"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        budget("FOOD", 100_000, "2026-08"),
      ],
      spentByMonthCategory: SPENT_NONE,
      carryOverEnabled: false,
    })

    expect(chain.get("2026-08")!.get("FOOD")!.rollover).toBe(0)
    expect(chain.get("2026-08")!.get("FOOD")!.effectiveAmount).toBe(100_000)
  })

  it("never carries a negative (over-budget) amount", () => {
    const spent = new Map([
      ["2026-07", new Map([["FOOD", 150_000]])],
    ])

    const chain = computeCarryOverChain({
      months: ["2026-07", "2026-08"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        budget("FOOD", 100_000, "2026-08"),
      ],
      spentByMonthCategory: spent,
      carryOverEnabled: true,
    })

    expect(chain.get("2026-07")!.get("FOOD")!.unused).toBe(0)
    expect(chain.get("2026-08")!.get("FOOD")!.rollover).toBe(0)
  })

  it("keeps each category's chain independent", () => {
    const chain = computeCarryOverChain({
      months: ["2026-07", "2026-08"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        budget("TRANSPORT", 50_000, "2026-07"),
        budget("FOOD", 100_000, "2026-08"),
        budget("TRANSPORT", 50_000, "2026-08"),
      ],
      spentByMonthCategory: SPENT_NONE,
      carryOverEnabled: true,
    })

    expect(chain.get("2026-08")!.get("FOOD")!.rollover).toBe(100_000)
    expect(chain.get("2026-08")!.get("TRANSPORT")!.rollover).toBe(50_000)
  })

  it("sorts unordered months oldest → newest", () => {
    const chain = computeCarryOverChain({
      months: ["2026-09", "2026-07", "2026-08"],
      budgets: [
        budget("FOOD", 100_000, "2026-07"),
        budget("FOOD", 100_000, "2026-08"),
        budget("FOOD", 100_000, "2026-09"),
      ],
      spentByMonthCategory: SPENT_NONE,
      carryOverEnabled: true,
    })

    expect(chain.get("2026-08")!.get("FOOD")!.rollover).toBe(100_000)
    expect(chain.get("2026-09")!.get("FOOD")!.rollover).toBe(200_000)
  })
})

describe("buildSpentByMonthCategory", () => {
  const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0)

  it("buckets expenses by budget month and category, ignoring income", () => {
    const map = buildSpentByMonthCategory(
      [
        { type: "EXPENSE", category: "FOOD", amount: 1000, date: D(2026, 7, 10) },
        { type: "EXPENSE", category: "FOOD", amount: 500, date: D(2026, 7, 20) },
        { type: "INCOME", category: "SALARY", amount: 9000, date: D(2026, 7, 1) },
        { type: "EXPENSE", category: "TRANSPORT", amount: 200, date: D(2026, 8, 3) },
      ],
      1,
    )

    expect(map.get("2026-07")!.get("FOOD")).toBe(1500)
    expect(map.get("2026-07")!.get("SALARY")).toBeUndefined()
    expect(map.get("2026-08")!.get("TRANSPORT")).toBe(200)
  })

  it("uses the budget month boundaries for a mid-month cycle", () => {
    // startDay=28 → 2026-08 = 28 Aug – 27 Sep. A Sep 10 expense belongs there.
    const map = buildSpentByMonthCategory(
      [{ type: "EXPENSE", category: "FOOD", amount: 300, date: D(2026, 9, 10) }],
      28,
    )

    expect(map.get("2026-08")!.get("FOOD")).toBe(300)
  })
})
