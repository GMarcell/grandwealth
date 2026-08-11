/**
 * 50/30/20 budget template builder.
 *
 * Given a month's income and the user's expense categories classified as
 * NEED / WANT / SAVINGS, distributes:
 *   - 50% of income across NEED categories
 *   - 30% of income across WANT categories
 *   - 20% of income across SAVINGS categories
 *
 * Within a rule-type group the pool is split proportionally to each category's
 * average monthly spending (historical weighting); when there is no spending
 * history the pool is split evenly.
 */

export type RuleType = "NEED" | "WANT" | "SAVINGS"

export interface TemplateCategory {
  name: string
  ruleType: RuleType | null
}

export interface TemplateBudget {
  categoryName: string
  amount: number
}

export interface BudgetTemplateInput {
  /** Income for the target month (drives pool sizes). */
  income: number
  /** Expense categories with their 50/30/20 classification. */
  categories: TemplateCategory[]
  /** Average monthly spending per category name (history weighting). */
  historyByCategory: Record<string, number>
}

export interface BudgetTemplateResult {
  budgets: TemplateBudget[]
  skippedGroups: RuleType[]
}

const TARGET_PERCENT: Record<RuleType, number> = {
  NEED: 0.5,
  WANT: 0.3,
  SAVINGS: 0.2,
}

export function buildBudgetTemplate(
  input: BudgetTemplateInput,
): BudgetTemplateResult {
  const { income, categories, historyByCategory } = input
  const budgets: TemplateBudget[] = []
  const skippedGroups: RuleType[] = []

  const groups: RuleType[] = ["NEED", "WANT", "SAVINGS"]

  for (const group of groups) {
    const members = categories.filter((c) => c.ruleType === group)

    if (members.length === 0) {
      skippedGroups.push(group)
      continue
    }

    const pool = income * TARGET_PERCENT[group]
    if (pool <= 0) {
      skippedGroups.push(group)
      continue
    }

    const totalHistory = members.reduce(
      (sum, c) => sum + (historyByCategory[c.name] ?? 0),
      0,
    )

    let remaining = pool
    const allocations: TemplateBudget[] = []

    members.forEach((member, index) => {
      const isLast = index === members.length - 1

      let amount: number
      if (totalHistory > 0) {
        const weight = (historyByCategory[member.name] ?? 0) / totalHistory
        amount = pool * weight
      } else {
        amount = pool / members.length
      }

      if (isLast) {
        // The last member absorbs rounding drift so the group always sums to
        // its target pool.
        amount = remaining
      } else {
        amount = Math.round(amount)
        remaining -= amount
      }

      if (amount > 0) {
        allocations.push({ categoryName: member.name, amount })
      }
    })

    if (allocations.length === 0) {
      skippedGroups.push(group)
      continue
    }

    budgets.push(...allocations)
  }

  return { budgets, skippedGroups }
}
