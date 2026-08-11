import { describe, it, expect } from "vitest"
import { buildBudgetTemplate } from "../budget-template"

const categories = [
  { name: "HOUSING", ruleType: "NEED" as const },
  { name: "FOOD", ruleType: "NEED" as const },
  { name: "ENTERTAINMENT", ruleType: "WANT" as const },
  { name: "SAVINGS", ruleType: "SAVINGS" as const },
]

describe("buildBudgetTemplate", () => {
  it("splits 50/30/20 of income across classified groups", () => {
    const result = buildBudgetTemplate({
      income: 10_000_000,
      categories,
      historyByCategory: {},
    })

    const needTotal = result.budgets
      .filter((b) => b.categoryName === "HOUSING" || b.categoryName === "FOOD")
      .reduce((s, b) => s + b.amount, 0)
    const wantTotal = result.budgets
      .filter((b) => b.categoryName === "ENTERTAINMENT")
      .reduce((s, b) => s + b.amount, 0)
    const savingsTotal = result.budgets
      .filter((b) => b.categoryName === "SAVINGS")
      .reduce((s, b) => s + b.amount, 0)

    expect(needTotal).toBe(5_000_000) // 50%
    expect(wantTotal).toBe(3_000_000) // 30%
    expect(savingsTotal).toBe(2_000_000) // 20%
    expect(result.skippedGroups).toHaveLength(0)
  })

  it("weights allocations by historical spending within a group", () => {
    const result = buildBudgetTemplate({
      income: 10_000_000,
      categories: [
        { name: "HOUSING", ruleType: "NEED" as const },
        { name: "FOOD", ruleType: "NEED" as const },
      ],
      historyByCategory: {
        HOUSING: 6_000_000,
        FOOD: 2_000_000, // 75% / 25% split
      },
    })

    const housing = result.budgets.find((b) => b.categoryName === "HOUSING")!
    const food = result.budgets.find((b) => b.categoryName === "FOOD")!

    expect(housing.amount).toBe(3_750_000) // 75% of 5jt
    expect(food.amount).toBe(1_250_000) // 25% of 5jt
    expect(housing.amount + food.amount).toBe(5_000_000)
  })

  it("splits evenly when there is no spending history", () => {
    const result = buildBudgetTemplate({
      income: 10_000_000,
      categories: [
        { name: "A", ruleType: "NEED" as const },
        { name: "B", ruleType: "NEED" as const },
        { name: "C", ruleType: "NEED" as const },
      ],
      historyByCategory: {},
    })

    const total = result.budgets.reduce((s, b) => s + b.amount, 0)
    expect(total).toBe(5_000_000)
    expect(result.budgets).toHaveLength(3)
    expect(result.budgets[0].amount).toBe(1_666_667)
    expect(result.budgets[2].amount).toBe(1_666_666) // absorbs rounding
  })

  it("skips groups with no classified categories", () => {
    const result = buildBudgetTemplate({
      income: 10_000_000,
      categories: [{ name: "HOUSING", ruleType: "NEED" as const }],
      historyByCategory: {},
    })

    expect(result.skippedGroups).toContain("WANT")
    expect(result.skippedGroups).toContain("SAVINGS")
    expect(result.budgets).toHaveLength(1)
    expect(result.budgets[0].amount).toBe(5_000_000)
  })

  it("returns nothing when income is zero", () => {
    const result = buildBudgetTemplate({
      income: 0,
      categories,
      historyByCategory: {},
    })

    expect(result.budgets).toHaveLength(0)
    expect(result.skippedGroups).toHaveLength(3)
  })
})
