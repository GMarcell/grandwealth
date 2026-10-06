/**
 * AI savings-goal planner (admin-only).
 *
 * Given a savings goal and a deadline, works out how much must be saved each
 * month and asks Groq for a concrete plan to get there — grounded in the
 * user's LAST completed budget month of actual income and spending, so the
 * suggested cuts come from categories the user really spends on.
 *
 * The hard numbers (months left, required monthly saving, last month's net)
 * are computed here, not by the model. The model only supplies the qualitative
 * assessment, actions, and category-level cut suggestions, which are validated
 * against the real spending data before being returned.
 *
 * Users can also choose to include investment options (savings accounts, gold,
 * or selling stocks) in their plan, with pros and cons for each option.
 */

import { z } from "zod"
import Groq from "groq-sdk"
import { prisma } from "@/lib/prisma"
import {
  getBudgetMonthLabel,
  getBudgetMonthRangeInclusive,
  getLastCompletedBudgetMonthKey,
} from "@/lib/budget-months"
import { fetchGoldPriceIdr } from "@/lib/prices"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

/** Average Gregorian month length in ms, used for month math. */
const AVG_MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000

/** Format a number as IDR with locale formatting */
function formatIDR(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`
}

/** Get current gold price in IDR/gram, fallback to 0 if unavailable */
async function getGoldPrice(): Promise<number> {
  try {
    const result = await fetchGoldPriceIdr()
    return result.pricePerGramIdr
  } catch {
    return 0
  }
}

export type GoalFeasibility = "ON_TRACK" | "TIGHT" | "UNREALISTIC"

export interface GoalCategoryCut {
  category: string
  /** How much per month the user is advised to cut from this category. */
  monthlySaving: number
  reason: string | null
}

export interface AiGoalPlan {
  goal: {
    id: string
    name: string
    targetAmount: number
    savedAmount: number
    deadline: string // YYYY-MM-DD
  }
  /** Whole months between now and the deadline (at least 1). */
  monthsRemaining: number
  /** targetAmount - savedAmount, floored at 0. */
  remaining: number
  /** remaining / monthsRemaining. */
  requiredMonthlySaving: number
  /** Last completed budget month's income/expenses and per-category spending. */
  lastMonth: {
    sourceMonth: string
    income: number
    expenses: number
    netSaving: number
    categories: Array<{ name: string; spent: number }>
  }
  summary: string
  feasibility: GoalFeasibility
  actions: string[]
  categoryCuts: GoalCategoryCut[]
  /** Last month's net saving plus every suggested category cut. */
  projectedMonthlySaving: number
  /** How far the projected saving falls short of the required monthly amount. */
  shortfall: number
  /** User-selected options to include in the plan. */
  includeOptions: {
    includeSavings: boolean
    includeGold: boolean
    includeSellStocks: boolean
  }
  /** Investment options with pros and cons, based on user's actual holdings. */
  investmentOptions: Array<{
    type: "SAVINGS" | "GOLD" | "SELL_STOCKS"
    title: string
    description: string
    pros: string[]
    cons: string[]
    relevantData?: Record<string, number | string>
  }>
}

/** Error carrying an HTTP status so the route can respond meaningfully. */
export class GoalAiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message)
    this.name = "GoalAiError"
  }
}

/**
 * Whole months between `from` and `deadline`, rounding a partial month up so a
 * goal due in six weeks still gets a month of runway. Returns 0 when the
 * deadline is not in the future.
 */
export function monthsUntil(deadline: Date, from: Date = new Date()): number {
  const ms = deadline.getTime() - from.getTime()
  if (ms <= 0) return 0
  return Math.max(1, Math.ceil(ms / AVG_MONTH_MS))
}

/**
 * Classify how realistic the goal is given the user's monthly saving capacity.
 * Used both as the server's own assessment and as a fallback when the model
 * returns an unusable value.
 */
export function feasibilityFrom(
  requiredMonthlySaving: number,
  monthlyCapacity: number,
): GoalFeasibility {
  if (requiredMonthlySaving <= 0) return "ON_TRACK"
  if (monthlyCapacity >= requiredMonthlySaving) return "ON_TRACK"
  if (monthlyCapacity >= requiredMonthlySaving * 0.6) return "TIGHT"
  return "UNREALISTIC"
}

export const GOAL_PLAN_SYSTEM_PROMPT = `You are a personal savings coach for an Indonesian personal finance app. You are given a savings goal, a deadline, and the user's actual income and spending from last month. Produce a realistic plan to reach the goal by the deadline.

Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "summary": "two or three sentences in Bahasa Indonesia assessing whether the goal is reachable and why",
  "feasibility": "ON_TRACK" | "TIGHT" | "UNREALISTIC",
  "actions": ["concrete step in Bahasa Indonesia", "..."],
  "categoryCuts": [
    { "category": "CATEGORY_NAME", "monthlySaving": 300000, "reason": "short reason in Bahasa Indonesia" }
  ]
}

Rules:
- "feasibility" must be exactly one of ON_TRACK, TIGHT, UNREALISTIC. Use TIGHT when the required monthly saving is close to what the user can afford, UNREALISTIC when it is far beyond their capacity.
- "actions": 3 to 5 specific, actionable steps. Reference real numbers where useful (e.g. how much to set aside each month). Write in Bahasa Indonesia.
- "categoryCuts": only categories listed in the user's last-month spending. Never invent categories. "monthlySaving" is a whole number in IDR, greater than 0 and never more than the amount actually spent in that category last month.
- Suggest cuts that add up to cover the shortfall when there is one. If the goal is comfortably affordable, few or no cuts are needed.
- Base your advice on the real figures provided. Do not promise investment returns.
- Respond with JSON only.`

export interface GoalPlanPromptInput {
  goalName: string
  targetAmount: number
  savedAmount: number
  remaining: number
  deadlineLabel: string
  monthsRemaining: number
  requiredMonthlySaving: number
  sourceMonthLabel: string
  income: number
  expenses: number
  netSaving: number
  categories: Array<{ name: string; spent: number }>
}

/** Build the user prompt. Pure so it can be unit tested without a database. */
export function buildGoalPlanPrompt(input: GoalPlanPromptInput): string {
  const idr = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`
  const lines = input.categories.map((c) => `- ${c.name}: ${idr(c.spent)}`)

  return `Bantu saya mencapai target tabungan berikut.

Target: ${input.goalName}
Jumlah target: ${idr(input.targetAmount)}
Sudah terkumpul: ${idr(input.savedAmount)}
Sisa yang dibutuhkan: ${idr(input.remaining)}
Tenggat: ${input.deadlineLabel} (sekitar ${input.monthsRemaining} bulan lagi)
Tabungan per bulan yang dibutuhkan: ${idr(input.requiredMonthlySaving)}

Data keuangan bulan lalu (${input.sourceMonthLabel}):
- Pendapatan: ${idr(input.income)}
- Pengeluaran: ${idr(input.expenses)}
- Sisa bersih per bulan: ${idr(input.netSaving)}

Pengeluaran per kategori bulan lalu:
${lines.join("\n") || "Tidak ada data pengeluaran."}

Gunakan hanya nama kategori di atas untuk categoryCuts. Kembalikan JSON sesuai format yang diminta.`
}

const rawPlanSchema = z.object({
  summary: z.string().optional(),
  feasibility: z.string().optional(),
  actions: z.array(z.string()).optional(),
  categoryCuts: z
    .array(
      z.object({
        category: z.string(),
        monthlySaving: z.coerce.number().finite(),
        reason: z.string().optional(),
      }),
    )
    .optional(),
})

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced ? fenced[1] : trimmed).trim()
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start === -1 || end <= start) {
      throw new GoalAiError("AI returned an invalid goal plan — please try again", 502)
    }
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      throw new GoalAiError("AI returned an invalid goal plan — please try again", 502)
    }
  }
}

const FEASIBILITY_VALUES: GoalFeasibility[] = ["ON_TRACK", "TIGHT", "UNREALISTIC"]

/**
 * Parse and sanitize the model's raw response.
 *
 * Category cuts are restricted to categories the user actually spent in and
 * capped at what they spent there; unknown categories and non-positive amounts
 * are dropped. `feasibility` falls back to null when the model returns an
 * unusable value so the caller can substitute its own assessment.
 */
export function parseAiGoalPlanResponse(
  rawText: string,
  spendingByCategory: Record<string, number>,
): {
  summary: string
  feasibility: GoalFeasibility | null
  actions: string[]
  categoryCuts: GoalCategoryCut[]
} {
  const json = extractJson(rawText)
  const parsed = rawPlanSchema.safeParse(json)
  if (!parsed.success) {
    throw new GoalAiError("AI returned an invalid goal plan — please try again", 502)
  }

  const summary = parsed.data.summary?.trim() ?? ""
  const actions = (parsed.data.actions ?? [])
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 6)

  const rawFeasibility = parsed.data.feasibility?.trim().toUpperCase()
  const feasibility = FEASIBILITY_VALUES.includes(rawFeasibility as GoalFeasibility)
    ? (rawFeasibility as GoalFeasibility)
    : null

  const merged = new Map<string, GoalCategoryCut>()
  for (const cut of parsed.data.categoryCuts ?? []) {
    const category = cut.category.trim()
    const spent = spendingByCategory[category]
    if (spent === undefined) continue
    if (!Number.isFinite(cut.monthlySaving) || cut.monthlySaving <= 0) continue

    // Never advise cutting more than was actually spent in that category.
    const monthlySaving = Math.min(Math.round(cut.monthlySaving), Math.round(spent))
    if (monthlySaving <= 0) continue

    const existing = merged.get(category)
    if (existing) {
      existing.monthlySaving = Math.min(
        existing.monthlySaving + monthlySaving,
        Math.round(spent),
      )
      if (!existing.reason && cut.reason) existing.reason = cut.reason.trim() || null
    } else {
      merged.set(category, {
        category,
        monthlySaving,
        reason: cut.reason?.trim() || null,
      })
    }
  }

  const categoryCuts = [...merged.values()].sort(
    (a, b) => b.monthlySaving - a.monthlySaving,
  )

  if (!summary && actions.length === 0 && categoryCuts.length === 0) {
    throw new GoalAiError("AI returned an empty goal plan — please try again", 502)
  }

  return { summary, feasibility, actions, categoryCuts }
}

/**
 * Generate an AI plan to reach `goalId` by `deadline` (defaults to the goal's
 * own target date when omitted), grounded in last month's spending.
 *
 * Users can optionally include investment options (savings accounts, gold,
 * or selling stocks) in their plan.
 */
export async function generateAiGoalPlanForUser(
  userId: string,
  goalId: string,
  deadlineISO: string | null,
  includeOptions: {
    includeSavings?: boolean
    includeGold?: boolean
    includeSellStocks?: boolean
  } = {},
): Promise<AiGoalPlan> {
  if (!process.env.GROQ_API_KEY) {
    throw new GoalAiError("AI goal planning is not configured (missing GROQ_API_KEY)", 503)
  }

  const goal = await prisma.savingsGoal.findUnique({ where: { id: goalId } })
  if (!goal || goal.userId !== userId) {
    throw new GoalAiError("Goal not found", 404)
  }

  const rawDeadline = deadlineISO ?? goal.targetDate?.toISOString().slice(0, 10) ?? null
  if (!rawDeadline) {
    throw new GoalAiError("A deadline is required to plan this goal", 400)
  }
  const deadline = new Date(rawDeadline)
  if (Number.isNaN(deadline.getTime())) {
    throw new GoalAiError("Invalid deadline", 400)
  }

  const monthsRemaining = monthsUntil(deadline)
  if (monthsRemaining === 0) {
    throw new GoalAiError("The deadline must be in the future", 400)
  }

  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)
  if (remaining <= 0) {
    throw new GoalAiError("This goal has already been reached", 400)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { budgetStartDay: true },
  })
  if (!user) throw new GoalAiError("User not found", 404)

  const startDay = user.budgetStartDay ?? 1
  const sourceMonth = getLastCompletedBudgetMonthKey(startDay)
  const { start, end } = getBudgetMonthRangeInclusive(sourceMonth, startDay)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { type: true, category: true, amount: true },
  })

  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0)
  const expenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0)
  const netSaving = income - expenses

  const spentByCategory = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== "EXPENSE") continue
    spentByCategory.set(tx.category, (spentByCategory.get(tx.category) ?? 0) + tx.amount)
  }
  const categories = [...spentByCategory.entries()]
    .map(([name, spent]) => ({ name, spent }))
    .sort((a, b) => b.spent - a.spent)
  const spendingByCategory = Object.fromEntries(spentByCategory)

  if (categories.length === 0) {
    throw new GoalAiError(
      `No expenses found in ${getBudgetMonthLabel(sourceMonth, startDay)}. Record some spending first so the plan has data to work from.`,
      400,
    )
  }

  const requiredMonthlySaving = remaining / monthsRemaining

  // Fetch user's gold and stock holdings for investment options
  const goldDeposits = await prisma.goldDeposit.findMany({
    where: { userId, type: "BUY" },
    select: { weightGram: true, pricePerGram: true, totalAmount: true, date: true },
    orderBy: { date: "desc" },
  })

  const currentGoldPrice = await getGoldPrice()
  const stocks = await prisma.stock.findMany({
    where: { userId },
    select: {
      id: true,
      symbol: true,
      name: true,
      quantity: true,
      buyPrice: true,
      currentPrice: true,
    },
  })

  // Calculate total gold holdings
  const totalGoldWeight = goldDeposits.reduce((sum, g) => sum + g.weightGram, 0)
  const totalGoldCost = goldDeposits.reduce((sum, g) => sum + g.totalAmount, 0)
  const currentGoldValue = totalGoldWeight * (currentGoldPrice ?? 0)
  const goldProfitLoss = currentGoldValue - totalGoldCost

  // Calculate total stock portfolio value and potential selling proceeds
  let totalStockValue = 0
  let totalStockCost = 0
  const stocksWithProfit: Array<{
    symbol: string
    name: string
    quantity: number
    currentPrice: number
    costPerShare: number
    currentValue: number
    costBasis: number
    profitLoss: number
    profitPercent: number
  }> = []

  for (const stock of stocks) {
    const currentPrice = stock.currentPrice ?? stock.buyPrice
    const currentValue = stock.quantity * currentPrice
    const costBasis = stock.quantity * stock.buyPrice
    const profitLoss = currentValue - costBasis
    const profitPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0

    totalStockValue += currentValue
    totalStockCost += costBasis

    if (currentPrice > 0) {
      stocksWithProfit.push({
        symbol: stock.symbol,
        name: stock.name,
        quantity: stock.quantity,
        currentPrice,
        costPerShare: stock.buyPrice,
        currentValue,
        costBasis,
        profitLoss,
        profitPercent,
      })
    }
  }

  const includeSavings = includeOptions.includeSavings ?? true
  const includeGold = includeOptions.includeGold ?? true
  const includeSellStocks = includeOptions.includeSellStocks ?? true

  // Build investment options with pros and cons
  const investmentOptions: AiGoalPlan["investmentOptions"] = []

  if (includeSavings) {
    investmentOptions.push({
      type: "SAVINGS",
      title: "Tabungan Berjangka / Deposito",
      description: `Kumpulkan ${formatIDR(requiredMonthlySaving)} per bulan dari pemotongan pengeluaran untuk mendanai tujuan Anda.`,
      pros: [
        "Mudah dilakukan — bisa otomatis melalui transfer bulanan",
        "Tidak ada risiko kerugian modal",
        "Cairan fleksibel sesuai tenor",
        "Bunga deposito bisa lebih tinggi daripada tabungan biasa",
      ],
      cons: [
        "Bunga biasanya lebih rendah daripada investasi lain",
        "Mungkin sulit mencapai target jika perbedaannya besar",
        "Bunga subject to pajak",
      ],
      relevantData: {
        requiredMonthlySaving,
        monthsRemaining,
        totalNeeded: remaining,
      },
    })
  }

  if (includeGold && totalGoldWeight > 0) {
    investmentOptions.push({
      type: "GOLD",
      title: "Jual/emas untuk Mendanai Goal",
      description: `Anda memiliki ${totalGoldWeight.toFixed(2)} gram emas dengan nilai saat ini sekitar ${formatIDR(currentGoldValue)}.`,
      pros: [
        "Emas mudah dicairkan dan likuid",
        "Nilai emas bisa lebih tinggi jika harga naik",
        "Emas dianggap sebagai lindung nilai inflasi",
      ],
      cons: [
        "Harga emas fluktuatif — bisa turun saat Anda menjual",
        "Mungkin incur biaya transaksi saat menjual",
        "Kehilangan aset investasi jangka panjang",
        "Tidak ada pendapatan pasif seperti dividen",
      ],
      relevantData: {
        totalGoldWeight: Math.round(totalGoldWeight * 100) / 100,
        currentGoldPrice: Math.round(currentGoldPrice ?? 0),
        currentGoldValue: Math.round(currentGoldValue),
        costBasis: Math.round(totalGoldCost),
        unrealizedPnl: Math.round(goldProfitLoss),
      },
    })
  }

  if (includeSellStocks && stocksWithProfit.length > 0) {
    const profitableStocks = stocksWithProfit.filter((s) => s.profitLoss > 0)
    const totalPotentialProceeds = profitableStocks.reduce((sum, s) => sum + s.currentValue, 0)

    investmentOptions.push({
      type: "SELL_STOCKS",
      title: "Jual Saham untuk Mendanai Goal",
      description: `Anda memiliki ${profitableStocks.length} saham dengan unrealised profit. Total nilai portofolio saat ini sekitar ${formatIDR(totalStockValue)}.`,
      pros: [
        "Potensi profit instant jika harga sudah mahal",
        "Diversifikasi yang baik — tidak semua telur di satu keranjang",
        "Modal bisa langsung digunakan untuk goal",
      ],
      cons: [
        "Pertumbuhan saham jangka panjang bisa lebih besar daripada menggunakan modal sekarang",
        "Pajak Capital Gains (PPH final 0.1% untuk saham umum)",
        "Kehilangan potensi dividen di masa depan",
        "Timing pasar sulit — jual saat harga rendah bisa merugikan",
      ],
      relevantData: {
        stockCount: stocksWithProfit.length,
        profitableCount: profitableStocks.length,
        totalStockValue: Math.round(totalStockValue),
        totalCostBasis: Math.round(totalStockCost),
        totalPotentialProceeds: Math.round(totalPotentialProceeds),
        totalUnrealizedPnl: Math.round(profitableStocks.reduce((sum, s) => sum + s.profitLoss, 0)),
      },
    })
  }

  const prompt = buildGoalPlanPrompt({
    goalName: goal.name,
    targetAmount: goal.targetAmount,
    savedAmount: goal.savedAmount,
    remaining,
    deadlineLabel: rawDeadline,
    monthsRemaining,
    requiredMonthlySaving,
    sourceMonthLabel: getBudgetMonthLabel(sourceMonth, startDay),
    income,
    expenses,
    netSaving,
    categories,
  })

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"
  const isReasoningModel = /gpt-oss|qwen|deepseek/i.test(model)
  const buildRequest = (maxCompletionTokens: number) => ({
    messages: [
      { role: "system" as const, content: GOAL_PLAN_SYSTEM_PROMPT },
      { role: "user" as const, content: prompt },
    ],
    model,
    temperature: 0.5,
    max_completion_tokens: maxCompletionTokens,
    response_format: { type: "json_object" as const },
    ...(isReasoningModel ? { reasoning_effort: "low" as const } : {}),
  })

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
    throw new GoalAiError("AI returned an empty goal plan — please try again", 502)
  }

  const ai = parseAiGoalPlanResponse(result.content, spendingByCategory)
  const feasibility =
    ai.feasibility ?? feasibilityFrom(requiredMonthlySaving, netSaving)

  const cutsTotal = ai.categoryCuts.reduce((sum, c) => sum + c.monthlySaving, 0)
  const projectedMonthlySaving = netSaving + cutsTotal
  const shortfall = Math.max(0, requiredMonthlySaving - projectedMonthlySaving)

  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    goal: {
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: rawDeadline,
    },
    monthsRemaining,
    remaining: round2(remaining),
    requiredMonthlySaving: round2(requiredMonthlySaving),
    lastMonth: {
      sourceMonth,
      income: round2(income),
      expenses: round2(expenses),
      netSaving: round2(netSaving),
      categories: categories.map((c) => ({ name: c.name, spent: round2(c.spent) })),
    },
    summary: ai.summary,
    feasibility,
    actions: ai.actions,
    categoryCuts: ai.categoryCuts,
    projectedMonthlySaving: round2(projectedMonthlySaving),
    shortfall: round2(shortfall),
    includeOptions: {
      includeSavings,
      includeGold,
      includeSellStocks,
    },
    investmentOptions,
  }
}
