/**
 * AI budget planner (admin-only).
 *
 * Turns LAST month's actual spending into a proposed budget for the target
 * month using Groq. This is the LLM counterpart to the deterministic 50/30/20
 * planner in `budget-planner.ts`: regular users get the deterministic plan,
 * administrators may additionally generate an AI-proposed plan.
 *
 * The model is only ever allowed to allocate to categories the user actually
 * spent money in during the source month, so a hallucinated category can never
 * create a budget for something the user doesn't use. All amounts are
 * re-validated server-side before they are shown or applied.
 */

import { z } from "zod"
import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import {
  getBudgetMonthLabel,
  getBudgetMonthRangeInclusive,
  getPreviousBudgetMonthKey,
} from "@/lib/budget-months"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export interface AiBudgetSuggestion {
  categoryName: string
  amount: number
  reason: string | null
}

export interface AiBudgetPlan {
  /** Budget month the plan is for ("YYYY-MM"). */
  month: string
  /** Completed budget month the spending data came from ("YYYY-MM"). */
  sourceMonth: string
  /** Short human-readable explanation of the strategy. */
  summary: string
  /** Income recorded in the source month, if any. */
  totalIncome: number
  /** Total spending in the source month. */
  totalExpenses: number
  /** Sum of the proposed category budgets. */
  totalBudgeted: number
  budgets: AiBudgetSuggestion[]
}

/** Error carrying an HTTP status so the route can respond meaningfully. */
export class BudgetAiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message)
    this.name = "BudgetAiError"
  }
}

export const AI_BUDGET_PLAN_SYSTEM_PROMPT = `You are a personal budgeting assistant for a personal finance app. You produce a practical monthly budget from the user's ACTUAL spending in the previous month.

Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "summary": "one or two sentences explaining the strategy",
  "budgets": [
    { "category": "CATEGORY_NAME", "amount": 1500000, "reason": "short reason" }
  ]
}

Rules:
- Allocate a budget ONLY to the categories listed in the user data. Never invent categories and never rename them.
- "amount" must be a whole number in Indonesian Rupiah (IDR), greater than 0.
- Base most categories on last month's actual spending, but trim obvious overspending and leave realistic headroom. A category can go slightly above last month when the spending looked necessary or one-off spikes should be absorbed.
- Keep the total across all categories within the user's monthly income when income is provided. If last month's total spending exceeded income, propose a total that moves spending toward the income.
- Prefer a lean but realistic plan. Do not pad every category.
- Cover every category that had meaningful spending last month. You may omit a trivial category.
- Write "summary" and "reason" in English. Keep reasons under 12 words.
- Respond with JSON only.`

export interface BudgetPlanSourceData {
  monthLabel: string
  sourceMonthLabel: string
  totalIncome: number
  totalExpenses: number
  categories: Array<{ name: string; spent: number }>
  /** Categories that cannot have their budget reduced. */
  cannotReduceCategories: string[]
  /** Optional maximum total budget to constrain the plan. */
  maxTotalBudget?: number
}

/**
 * Build the user prompt describing last month's spending to the model.
 * Kept pure so it can be unit tested without a database or network.
 */
export function buildAiBudgetPlanPrompt(data: BudgetPlanSourceData): string {
  const idr = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`
  const lines = data.categories.map(
    (c) =>
      `- ${c.name}: ${idr(c.spent)}${
        data.totalExpenses > 0
          ? ` (${((c.spent / data.totalExpenses) * 100).toFixed(1)}% dari total)`
          : ""
      }`,
  )

  let constraints = `\n\nThe categories above are the exact category names to use. Return JSON in the requested format.`

  // Add constrained categories (cannot reduce)
  if (data.cannotReduceCategories.length > 0) {
    constraints = `\n\n CATEGORIES THAT MUST NOT BE REDUCED: ${data.cannotReduceCategories.join(", ")}. NEVER lower this category's budget compared with last month's spending. If needed, keep it the same or increase it.\n\n${constraints}`
  }

  if (data.maxTotalBudget != null) {
    constraints = `\n\n CONSTRAINT: The total budget across all categories must not exceed ${idr(data.maxTotalBudget)}. Adjust each category's budget (except the ones that must not be reduced) so the total stays under this limit.\n\n${constraints}`
  }

  return `Create a budget plan for ${data.monthLabel} based on last month's actual spending (${data.sourceMonthLabel}).

Income for ${data.sourceMonthLabel}: ${idr(data.totalIncome)}
Total spending for ${data.sourceMonthLabel}: ${idr(data.totalExpenses)}${data.maxTotalBudget != null ? `\n\nMaximum budget requested: ${idr(data.maxTotalBudget)}` : ""}

Spending by category last month:
${lines.join("\n")}${constraints}`
}

const rawBudgetSchema = z.object({
  category: z.string(),
  amount: z.coerce.number().finite(),
  reason: z.string().optional(),
})

const rawPlanSchema = z.object({
  summary: z.string().optional(),
  budgets: z.array(rawBudgetSchema),
})

/**
 * Pull the first JSON value out of an LLM response and normalize it to the
 * expected plan shape. Models occasionally wrap JSON in ``` fences or return a
 * bare array; both are handled here.
 */
function extractPlanJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : trimmed).trim()

  try {
    return JSON.parse(candidate)
  } catch {
    // Fall back to the outermost object/array in the text.
    const firstObj = candidate.indexOf("{")
    const firstArr = candidate.indexOf("[")
    const start =
      firstObj === -1
        ? firstArr
        : firstArr === -1
          ? firstObj
          : Math.min(firstObj, firstArr)
    const lastObj = candidate.lastIndexOf("}")
    const lastArr = candidate.lastIndexOf("]")
    const end = Math.max(lastObj, lastArr)
    if (start === -1 || end === -1 || end <= start) {
      throw new BudgetAiError("AI returned an invalid budget plan — please try again", 502)
    }
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      throw new BudgetAiError("AI returned an invalid budget plan — please try again", 502)
    }
  }
}

/**
 * Parse and sanitize the model's raw response into a plan.
 *
 * Only categories present in `allowedCategories` survive, duplicate categories
 * are summed, and non-positive amounts are dropped. Throws when nothing usable
 * remains, so a broken response is never applied over the user's budgets.
 */
export function parseAiBudgetResponse(
  rawText: string,
  allowedCategories: string[],
): { summary: string; budgets: AiBudgetSuggestion[] } {
  const allowed = new Set(allowedCategories)
  const json = extractPlanJson(rawText)

  // Accept `{ budgets: [...] }` and a bare `[...]` array.
  const normalized = Array.isArray(json)
    ? { summary: "", budgets: json }
    : (json as Record<string, unknown>)

  const parsed = rawPlanSchema.safeParse({
    summary: normalized?.summary,
    budgets: normalized?.budgets ?? (normalized as Record<string, unknown>)?.categories,
  })
  if (!parsed.success) {
    throw new BudgetAiError("AI returned an invalid budget plan — please try again", 502)
  }

  const merged = new Map<string, AiBudgetSuggestion>()
  for (const item of parsed.data.budgets) {
    const categoryName = item.category.trim()
    if (!allowed.has(categoryName)) continue
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue

    const amount = Math.round(item.amount)
    const existing = merged.get(categoryName)
    if (existing) {
      existing.amount += amount
      if (!existing.reason && item.reason) existing.reason = item.reason
    } else {
      merged.set(categoryName, {
        categoryName,
        amount,
        reason: item.reason?.trim() || null,
      })
    }
  }

  const budgets = [...merged.values()].sort((a, b) => b.amount - a.amount)
  if (budgets.length === 0) {
    throw new BudgetAiError(
      "AI did not propose any budgets from last month's spending. Add more transactions and try again.",
      502,
    )
  }

  return { summary: parsed.data.summary?.trim() ?? "", budgets }
}

/**
 * Generate an AI budget plan for `targetMonth` from the immediately preceding
 * budget month's spending.
 *
 * If `maxTotalBudget` is provided, the AI will constrain the total of all
 * category budgets to not exceed this amount.
 */
export async function generateAiBudgetPlanForUser(
  userId: string,
  targetMonth: string,
  maxTotalBudget?: number,
  cannotReduceCategories: string[] = [],
): Promise<AiBudgetPlan> {
  if (!process.env.GROQ_API_KEY) {
    throw new BudgetAiError("AI budget planning is not configured (missing GROQ_API_KEY)", 503)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, budgetStartDay: true },
  })
  if (!user) throw new BudgetAiError("User not found", 404)

  const startDay = user.budgetStartDay ?? 1
  const sourceMonth = getPreviousBudgetMonthKey(targetMonth, startDay)
  const { start, end } = getBudgetMonthRangeInclusive(sourceMonth, startDay)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { type: true, category: true, amount: true },
  })

  const expenseTxs = transactions.filter((t) => t.type === "EXPENSE")
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = expenseTxs.reduce((sum, t) => sum + t.amount, 0)

  if (expenseTxs.length === 0) {
    throw new BudgetAiError(
      `No expenses found in ${getBudgetMonthLabel(sourceMonth, startDay)}. Record some spending first so the AI has data to plan from.`,
      400,
    )
  }

  // Combine categories that cannot be reduced from both the passed parameter
  // and existing budgets in the target month
  const existingBudgets = await prisma.budget.findMany({
    where: { userId, month: targetMonth },
    select: { categoryName: true, canReduce: true },
  })
  const existingCannotReduce = new Set(
    existingBudgets.filter((b) => !b.canReduce).map((b) => b.categoryName),
  )
  // Merge: parameter categories + existing budget categories
  const allCannotReduceCategories = [...new Set([
    ...cannotReduceCategories,
    ...Array.from(existingCannotReduce),
  ])]

  const byCategory = new Map<string, number>()
  for (const tx of expenseTxs) {
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount)
  }
  const categories = [...byCategory.entries()]
    .map(([name, spent]) => ({ name, spent }))
    .sort((a, b) => b.spent - a.spent)

  const prompt = buildAiBudgetPlanPrompt({
    monthLabel: getBudgetMonthLabel(targetMonth, startDay),
    sourceMonthLabel: getBudgetMonthLabel(sourceMonth, startDay),
    totalIncome,
    totalExpenses,
    categories,
    cannotReduceCategories: allCannotReduceCategories,
    maxTotalBudget,
  })

  // Groq's model catalog changes over time; allow deployments to override it,
  // matching the monthly analysis generator.
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"
  const isReasoningModel = /gpt-oss|qwen|deepseek/i.test(model)

  const buildRequest = (maxCompletionTokens: number) => ({
    messages: [
      { role: "system" as const, content: AI_BUDGET_PLAN_SYSTEM_PROMPT },
      { role: "user" as const, content: prompt },
    ],
    model,
    temperature: 0.4,
    max_completion_tokens: maxCompletionTokens,
    response_format: { type: "json_object" as const },
    ...(isReasoningModel ? { reasoning_effort: "low" as const } : {}),
  })

  // A JSON response truncated at the token cap is unusable, so retry once with
  // more headroom when the model reports it hit `length`.
  const attempt = async (maxCompletionTokens: number) => {
    const completion = await groq.chat.completions.create(buildRequest(maxCompletionTokens))
    return {
      content: completion.choices[0]?.message?.content?.trim() ?? "",
      truncated: completion.choices[0]?.finish_reason === "length",
    }
  }

  let result = await attempt(4096)
  if (result.truncated) {
    const retry = await attempt(8192)
    if (retry.content.length > result.content.length) result = retry
  }

  if (!result.content) {
    throw new BudgetAiError("AI returned an empty budget plan — please try again", 502)
  }

  const { summary, budgets } = parseAiBudgetResponse(
    result.content,
    categories.map((c) => c.name),
  )

  return {
    month: targetMonth,
    sourceMonth,
    summary,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalBudgeted: budgets.reduce((sum, b) => sum + b.amount, 0),
    budgets,
  }
}
