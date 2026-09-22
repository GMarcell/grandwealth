import { prisma } from "@/lib/prisma"
import { computeGoldPortfolio } from "@/lib/gold"
import {
  getBudgetMonthLabel,
  getBudgetMonthRangeInclusive,
  getPreviousBudgetMonthKey,
} from "@/lib/budget-months"
import {
  buildSpentByMonthCategory,
  computeCarryOverChain,
} from "@/lib/budget-carry-over"
import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

const SHARES_PER_LOT = 100

const SYSTEM_PROMPT = `You are a friendly, professional personal financial analyst and savings coach. Your primary focus is helping users save more money and build wealth. Your job is to analyze a user's monthly financial data and provide insightful, actionable analysis in Indonesian/Bahasa Indonesia — with a strong emphasis on savings opportunities and recommendations.

Write a monthly financial analysis report in Markdown format. The report MUST cover:

1. **Ringkasan Bulanan** (Monthly Summary) — key figures: income, expenses, savings, savings rate
2. **Skor Kesehatan Tabungan** (Savings Health Score) — assessment of their savings rate compared to the 20% target:
   - 20%+ → "Excellent — you're building wealth!" 
   - 10-20% → "Good progress — let's push higher"
   - 0-10% → "Room for improvement — here's how"
   - Negative → "Need to turn this around — urgent action needed"
3. **Analisis Pengeluaran** (Spending Analysis) — top spending categories, where money leaks, and specific savings opportunities in each category
4. **Potensi Penghematan** (Savings Opportunities) — CRITICAL section: calculate and present concrete saving ideas
5. **Kinerja Anggaran** (Budget Performance) — how well budgets were followed, overruns
6. **Tabungan & Investasi** (Savings & Investments) — savings rate, stock & gold holdings, how to rebalance for better returns
7. **Rekomendasi Tabungan** (Savings Recommendations) — 3-4 SPECIFIC, actionable tips

CRITICAL: At least 40% of the report must focus on actionable savings strategies. Use Indonesian language (Bahasa). Format with Markdown headings and bullet points. Keep the whole report concise (roughly 600-800 words) and ALWAYS deliver every section in full — never stop mid-section or mid-sentence.`

export interface AnalysisResult {
  summary: string
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  topCategory: string | null
  topCategoryAmount: number | null
  stockValue: number
  goldValue: number
  budgetCount: number
  overBudgetCount: number
  transactionCount: number
  rawData: object
}

/**
 * Generate (or regenerate) an AI monthly analysis for a given user and month.
 * Fetches the user's transaction/budget/investment data for that month, asks
 * Groq AI for a report, and upserts the result into MonthlyAnalysis.
 */
export async function generateAnalysisForUserAndMonth(
  userId: string,
  monthKey: string
): Promise<AnalysisResult> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured")
  }

  // Fetch user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      budgetStartDay: true,
      carryOverEnabled: true,
    },
  })

  if (!user) throw new Error("User not found")

  // Inclusive end-of-day bounds, so transactions dated on the FINAL day of the
  // period are counted.
  const { start: monthStart, end: monthEnd } = getBudgetMonthRangeInclusive(
    monthKey,
    user.budgetStartDay
  )

  // Budget-month chain ending at the target month, oldest → newest. Required so
  // a budget can be adjusted by carry-over from earlier months exactly like the
  // budgets page and dashboard — over-budget checks must never use the raw
  // budget amount when rollover is enabled.
  const chainMonths: string[] = []
  let cursor = monthKey
  for (let i = 0; i < 13; i++) {
    chainMonths.unshift(cursor)
    cursor = getPreviousBudgetMonthKey(cursor, user.budgetStartDay)
  }

  // ── Fetch user's monthly data ──

  // Fetch the whole carry-over window in one query, then slice the target month
  // out of it for the report itself.
  const chainStart = getBudgetMonthRangeInclusive(
    chainMonths[0],
    user.budgetStartDay,
  ).start
  const chainTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: chainStart, lte: monthEnd },
    },
    orderBy: { date: "asc" },
  })

  const transactions = chainTransactions.filter((tx) => {
    const d = new Date(tx.date)
    return d >= monthStart && d <= monthEnd
  })

  const incomeTxs = transactions.filter((tx) => tx.type === "INCOME")
  const expenseTxs = transactions.filter((tx) => tx.type === "EXPENSE")

  const totalIncome = incomeTxs.reduce((sum, tx) => sum + tx.amount, 0)
  const totalExpenses = expenseTxs.reduce((sum, tx) => sum + tx.amount, 0)
  const netSavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  // Spending by category
  const spendingByCategory = new Map<string, number>()
  for (const tx of expenseTxs) {
    const current = spendingByCategory.get(tx.category) || 0
    spendingByCategory.set(tx.category, current + tx.amount)
  }
  const sortedSpending = Array.from(spendingByCategory.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  const topCategory = sortedSpending[0]?.category ?? null
  const topCategoryAmount = sortedSpending[0]?.total ?? null

  // Income by category
  const incomeByCategory = new Map<string, number>()
  for (const tx of incomeTxs) {
    const current = incomeByCategory.get(tx.category) || 0
    incomeByCategory.set(tx.category, current + tx.amount)
  }
  const sortedIncome = Array.from(incomeByCategory.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  // Budgets across the whole carry-over chain (so earlier months can roll into
  // the target month), plus the target month's own budgets.
  const allBudgets = await prisma.budget.findMany({
    where: { userId, month: { in: chainMonths } },
  })
  const budgets = allBudgets.filter((b) => b.month === monthKey)

  const carryOverChain = computeCarryOverChain({
    months: chainMonths,
    budgets: allBudgets,
    spentByMonthCategory: buildSpentByMonthCategory(
      chainTransactions,
      user.budgetStartDay,
    ),
    carryOverEnabled: user.carryOverEnabled ?? true,
  })
  const effectiveEntries = carryOverChain.get(monthKey)

  let overBudgetCount = 0
  const budgetDetails: Array<{
    category: string
    budgeted: number
    rollover: number
    effective: number
    spent: number
    remaining: number
    carryOverEnabled: boolean
  }> = []

  for (const budget of budgets) {
    const spent = spendingByCategory.get(budget.categoryName) ?? 0
    const entry = effectiveEntries?.get(budget.categoryName)
    // Carry-over-adjusted limit (budget + rollover), matching the budgets page.
    const effective = entry?.effectiveAmount ?? budget.amount
    const rollover = entry?.rollover ?? 0
    if (spent > effective) overBudgetCount++
    budgetDetails.push({
      category: budget.categoryName,
      budgeted: budget.amount,
      rollover,
      effective,
      spent,
      remaining: effective - spent,
      carryOverEnabled: user.carryOverEnabled ?? true,
    })
  }

  // Stocks
  const stocks = await prisma.stock.findMany({
    where: { userId },
  })
  let stockValue = 0
  const stockDetails: Array<{
    symbol: string
    name: string
    quantity: number
    buyPrice: number
    currentPrice: number | null
    value: number
  }> = []

  for (const stock of stocks) {
    const pricePerLot =
      stock.currentPrice != null
        ? stock.currentPrice * SHARES_PER_LOT
        : stock.buyPrice
    const value = pricePerLot * stock.quantity
    stockValue += value
    stockDetails.push({
      symbol: stock.symbol,
      name: stock.name,
      quantity: stock.quantity,
      buyPrice: stock.buyPrice,
      currentPrice: stock.currentPrice,
      value,
    })
  }

  // Gold — shared accounting helper (BUY adds weight + cost, SELL removes
  // weight + average-cost share) so the reported value matches the gold page,
  // dashboard, and net-worth history.
  const goldDeposits = await prisma.goldDeposit.findMany({
    where: { userId },
  })
  const { totalWeight: totalGoldWeight, totalInvested: totalGoldValue } =
    computeGoldPortfolio(goldDeposits)

  const rawData = {
    month: monthKey,
    transactions: {
      total: transactions.length,
      income: incomeTxs.length,
      expenses: expenseTxs.length,
    },
    incomeByCategory: sortedIncome,
    spendingByCategory: sortedSpending,
    budgetDetails,
    stockDetails,
    goldDetails: {
      totalWeightGram: Math.round(totalGoldWeight * 100) / 100,
      totalValue: Math.round(totalGoldValue * 100) / 100,
      depositCount: goldDeposits.length,
    },
  }

  // ── Generate analysis with Groq AI ──

  const userPrompt = `Buat analisis keuangan bulanan untuk ${user.name || "pengguna"} untuk bulan ${getBudgetMonthLabel(monthKey, user.budgetStartDay)}. FOKUS pada rekomendasi tabungan dan cara menghemat lebih banyak.

Data keuangan bulan ini:
- Total Pendapatan: Rp ${totalIncome.toLocaleString("id-ID")}
- Total Pengeluaran: Rp ${totalExpenses.toLocaleString("id-ID")}
- Tabungan Bersih: Rp ${netSavings.toLocaleString("id-ID")}
- Rasio Tabungan: ${savingsRate.toFixed(1)}%
- Jumlah Transaksi: ${transactions.length} (${incomeTxs.length} pemasukan, ${expenseTxs.length} pengeluaran)

Pengeluaran per Kategori (dari terbesar ke terkecil):
${sortedSpending
  .map(
    (s) =>
      `- ${s.category}: Rp ${s.total.toLocaleString("id-ID")} (${totalExpenses > 0 ? ((s.total / totalExpenses) * 100).toFixed(1) : 0}% dari total)`
  )
  .join("\n")}

Pendapatan per Kategori:
${sortedIncome.map((s) => `- ${s.category}: Rp ${s.total.toLocaleString("id-ID")}`).join("\n")}

Anggaran Bulanan (termasuk rollover dari bulan sebelumnya):
${budgetDetails
  .map(
    (b) =>
      `- ${b.category}: anggaran Rp ${b.budgeted.toLocaleString("id-ID")}${b.rollover > 0 ? ` + rollover Rp ${b.rollover.toLocaleString("id-ID")} = Rp ${b.effective.toLocaleString("id-ID")}` : ""}, terpakai Rp ${b.spent.toLocaleString("id-ID")}, sisa Rp ${b.remaining.toLocaleString("id-ID")}${b.remaining < 0 ? " (OVER BUDGET!)" : ""}`
  )
  .join("\n") || "Tidak ada anggaran yang ditetapkan."}

Portofolio Saham:
${stockDetails
  .map(
    (s) =>
      `- ${s.symbol} (${s.name}): ${s.quantity} lot (${(s.quantity * SHARES_PER_LOT).toLocaleString("id-ID")} lembar) @ Rp ${s.currentPrice?.toLocaleString("id-ID") ?? (s.buyPrice / SHARES_PER_LOT).toLocaleString("id-ID")}/saham = Rp ${s.value.toLocaleString("id-ID")}`
  )
  .join("\n") || "Tidak ada kepemilikan saham."}

${
  totalGoldWeight > 0
    ? `Emas: ${totalGoldWeight.toFixed(2)} gram, nilai Rp ${totalGoldValue.toLocaleString("id-ID")}`
    : "Tidak ada kepemilikan emas."
}

BERIKAN LANGKAH-LANGKAH HEMAT YANG SPESIFIK DAN BISA DILAKUKAN. Hitung potensi penghematan dalam Rupiah. Beri saran tabungan yang konkret. Gunakan Bahasa Indonesia dengan format Markdown.`

  // Groq deprecated llama-3.3-70b-versatile for non-enterprise access.
  // Allow deployments to override this as Groq's model catalog changes.
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b"

  // gpt-oss is a REASONING model: its reasoning tokens count against the
  // completion budget, so a small limit truncates the actual report (the
  // insight ends mid-sentence). The old `max_tokens: 2048` was far too small.
  // Give it a big budget, keep reasoning light so the report gets the room, and
  // retry once with a larger ceiling if the model still hits the cap.
  const isReasoningModel = /gpt-oss|qwen|deepseek/i.test(model)
  const buildRequest = (maxCompletionTokens: number) => ({
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: userPrompt },
    ],
    model,
    temperature: 0.7,
    max_completion_tokens: maxCompletionTokens,
    ...(isReasoningModel ? { reasoning_effort: "low" as const } : {}),
  })

  // Keep enough room for the requested 600–800 word report even when a
  // reasoning model spends completion tokens on internal reasoning.
  let completion = await groq.chat.completions.create(buildRequest(16_384))
  let summary = completion.choices[0]?.message?.content?.trim() ?? ""

  // `finish_reason === "length"` means the output was cut off — retry with more
  // headroom and keep whichever report is longer (i.e. more complete).
  if (completion.choices[0]?.finish_reason === "length") {
    const retry = await groq.chat.completions.create(buildRequest(32_768))
    const retried = retry.choices[0]?.message?.content?.trim() ?? ""
    if (retried.length > summary.length) summary = retried
  }

  // Never store an empty/thinking-only report as if it were a real analysis.
  if (!summary) {
    throw new Error("AI returned an empty analysis — please try again")
  }

  // ── Store analysis in database ──

  const result = {
    summary,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate: Math.round(savingsRate * 100) / 100,
    topCategory,
    topCategoryAmount,
    stockValue: Math.round(stockValue * 100) / 100,
    goldValue: Math.round(totalGoldValue * 100) / 100,
    budgetCount: budgets.length,
    overBudgetCount,
    transactionCount: transactions.length,
    rawData: JSON.stringify(rawData),
  }

  await prisma.monthlyAnalysis.upsert({
    where: {
      month_userId: {
        month: monthKey,
        userId,
      },
    },
    update: result,
    create: {
      ...result,
      month: monthKey,
      userId,
    },
  })

  return {
    ...result,
    rawData: rawData,
  }
}
