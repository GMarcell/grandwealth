/**
 * Budget planner (deterministic, no AI).
 *
 * Builds a proposed budget for the target month from data the user has already
 * recorded:
 *   - last month's actual spending, per category (used to weight categories
 *     within each 50/30/20 group), and
 *   - income recorded this month, falling back to last month's income, and
 *   - each category's NEED / WANT / SAVINGS classification (set in Settings).
 *
 * The 50/30/20 split itself is delegated to `buildBudgetTemplate`, so the
 * numbers match the template feature exactly. This module only assembles the
 * inputs and the human-readable summary.
 */

import { prisma } from "@/lib/prisma"
import {
  getBudgetMonthLabel,
  getBudgetMonthRangeInclusive,
  getPreviousBudgetMonthKey,
} from "@/lib/budget-months"
import { buildBudgetTemplate, type RuleType } from "@/lib/budget-template"

export interface PlannedBudget {
  categoryName: string
  amount: number
  ruleType: RuleType
  /** What the category actually cost last month. */
  spent: number
}

export interface BudgetPlan {
  /** Budget month the plan is for ("YYYY-MM"). */
  month: string
  /** Completed budget month the spending data came from ("YYYY-MM"). */
  sourceMonth: string
  /** Budget month the income figure came from ("YYYY-MM"). */
  incomeMonth: string
  /** Short explanation of how the plan was derived. */
  summary: string
  /** Income used as the 50/30/20 base. */
  income: number
  /** Total spending in the source month. */
  totalExpenses: number
  /** Sum of the proposed category budgets. */
  totalBudgeted: number
  budgets: PlannedBudget[]
  /** 50/30/20 groups with no classified category that had spending. */
  skippedGroups: RuleType[]
}

/** Error carrying an HTTP status so the route can respond meaningfully. */
export class BudgetPlanError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message)
    this.name = "BudgetPlanError"
  }
}

const GROUP_LABEL_ID: Record<RuleType, string> = {
  NEED: "needs",
  WANT: "wants",
  SAVINGS: "savings",
}

export interface PlanSummaryInput {
  monthLabel: string
  sourceMonthLabel: string
  incomeMonthLabel: string
  income: number
  skippedGroups: RuleType[]
}

/**
 * Build the short English summary shown above the plan.
 * Pure so it can be unit tested without a database.
 */
export function buildPlanSummary(input: PlanSummaryInput): string {
  const idr = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`
  const parts = [
    `The ${input.monthLabel} budget plan is based on ${input.sourceMonthLabel}'s spending and follows the 50/30/20 rule (50% needs, 30% wants, 20% savings) using ${input.incomeMonthLabel}'s income of ${idr(input.income)}.`,
  ]

  if (input.skippedGroups.length > 0) {
    const names = input.skippedGroups.map((g) => GROUP_LABEL_ID[g]).join(", ")
    parts.push(
      `No categories classified as ${names} had spending last month, so that portion hasn't been allocated yet. Set each category's type in Settings.`,
    )
  }

  return parts.join(" ")
}

/**
 * Generate a 50/30/20 budget plan for `targetMonth` from the immediately
 * preceding budget month's spending.
 */
export async function generateBudgetPlanForUser(
  userId: string,
  targetMonth: string,
): Promise<BudgetPlan> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { budgetStartDay: true },
  })
  if (!user) throw new BudgetPlanError("User not found", 404)

  const startDay = user.budgetStartDay ?? 1
  const sourceMonth = getPreviousBudgetMonthKey(targetMonth, startDay)
  const sourceRange = getBudgetMonthRangeInclusive(sourceMonth, startDay)
  const targetRange = getBudgetMonthRangeInclusive(targetMonth, startDay)

  const [sourceTransactions, targetIncomes, classifiedCategories] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: sourceRange.start, lte: sourceRange.end } },
      select: { type: true, category: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        type: "INCOME",
        date: { gte: targetRange.start, lte: targetRange.end },
      },
      select: { amount: true },
    }),
    prisma.category.findMany({
      where: { userId, ruleType: { not: null } },
      select: { name: true, ruleType: true },
    }),
  ])

  const expenseTxs = sourceTransactions.filter((t) => t.type === "EXPENSE")
  const sourceIncome = sourceTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0)

  const targetIncome = targetIncomes.reduce((sum, t) => sum + t.amount, 0)
  // Prefer this month's income once any has been recorded; otherwise fall back
  // to last month's income so a plan can still be produced early in the month.
  const income = targetIncome > 0 ? targetIncome : sourceIncome
  const incomeMonth = targetIncome > 0 ? targetMonth : sourceMonth

  if (expenseTxs.length === 0) {
    throw new BudgetPlanError(
      `No expenses found in ${getBudgetMonthLabel(sourceMonth, startDay)}. Record some spending first so the plan has data to work from.`,
      400,
    )
  }
  if (income <= 0) {
    throw new BudgetPlanError(
      `No income found for ${getBudgetMonthLabel(incomeMonth, startDay)}. Record income so the 50/30/20 split knows how much to allocate.`,
      400,
    )
  }

  const spentByCategory = new Map<string, number>()
  for (const tx of expenseTxs) {
    spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + tx.amount)
  }

  // Only categories that were both classified AND actually spent on last month
  // can receive an allocation — that is what makes the plan "based on last
  // month's expenses". Zero-spend categories would otherwise absorb a group's
  // leftover pool as the last member.
  const categories: Array<{ name: string; ruleType: RuleType }> = classifiedCategories
    .filter((c) => c.ruleType !== null && spentByCategory.has(c.name))
    .map((c) => ({ name: c.name, ruleType: c.ruleType as RuleType }))

  if (categories.length === 0) {
    throw new BudgetPlanError(
      "No classified expense categories had spending last month. Set each category's NEED / WANT / SAVINGS type in Settings, then try again.",
      400,
    )
  }

  // Weight each category by what it actually cost last month. Every remaining
  // category is guaranteed to have spending (filtered above).
  const historyByCategory: Record<string, number> = {}
  for (const category of categories) {
    historyByCategory[category.name] = spentByCategory.get(category.name) ?? 0
  }

  const { budgets, skippedGroups } = buildBudgetTemplate({
    income,
    categories,
    historyByCategory,
  })

  if (budgets.length === 0) {
    throw new BudgetPlanError(
      "No budgets could be generated from last month's spending. Add more transactions or classify your categories in Settings.",
      400,
    )
  }

  const ruleByCategory = new Map(categories.map((c) => [c.name, c.ruleType]))
  const planned: PlannedBudget[] = budgets
    .map((b) => ({
      categoryName: b.categoryName,
      amount: b.amount,
      ruleType: ruleByCategory.get(b.categoryName)!,
      spent: spentByCategory.get(b.categoryName) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const totalBudgeted = planned.reduce((sum, b) => sum + b.amount, 0)

  return {
    month: targetMonth,
    sourceMonth,
    incomeMonth,
    summary: buildPlanSummary({
      monthLabel: getBudgetMonthLabel(targetMonth, startDay),
      sourceMonthLabel: getBudgetMonthLabel(sourceMonth, startDay),
      incomeMonthLabel: getBudgetMonthLabel(incomeMonth, startDay),
      income,
      skippedGroups,
    }),
    income: Math.round(income * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalBudgeted,
    budgets: planned,
    skippedGroups,
  }
}
