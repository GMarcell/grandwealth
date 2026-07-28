import { prisma } from "@/lib/prisma"
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

CRITICAL: At least 40% of the report must focus on actionable savings strategies. Use Indonesian language (Bahasa). Format with Markdown headings and bullet points.`

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

  const [yearStr, monthStr] = monthKey.split("-")
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // JS months are 0-indexed

  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)

  // Fetch user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  })

  if (!user) throw new Error("User not found")

  // ── Fetch user's monthly data ──

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { date: "asc" },
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

  // Budgets for this month
  const budgets = await prisma.budget.findMany({
    where: { userId, month: monthKey },
  })

  let overBudgetCount = 0
  const budgetDetails: Array<{
    category: string
    budgeted: number
    spent: number
    remaining: number
    rolloverEnabled: boolean
  }> = []

  for (const budget of budgets) {
    const spent = spendingByCategory.get(budget.categoryName) ?? 0
    if (spent > budget.amount) overBudgetCount++
    budgetDetails.push({
      category: budget.categoryName,
      budgeted: budget.amount,
      spent,
      remaining: budget.amount - spent,
      rolloverEnabled: budget.rolloverEnabled,
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

  // Gold
  const goldDeposits = await prisma.goldDeposit.findMany({
    where: { userId },
  })
  let totalGoldWeight = 0
  let totalGoldValue = 0
  for (const deposit of goldDeposits) {
    if (deposit.type === "BUY") {
      totalGoldWeight += deposit.weightGram
      totalGoldValue += deposit.totalAmount
    } else {
      totalGoldWeight -= deposit.weightGram
      totalGoldValue -= deposit.totalAmount
    }
  }

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

  const userPrompt = `Buat analisis keuangan bulanan untuk ${user.name || "pengguna"} untuk bulan ${monthKey}. FOKUS pada rekomendasi tabungan dan cara menghemat lebih banyak.

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

Anggaran Bulanan:
${budgetDetails
  .map(
    (b) =>
      `- ${b.category}: anggaran Rp ${b.budgeted.toLocaleString("id-ID")}, terpakai Rp ${b.spent.toLocaleString("id-ID")}, sisa Rp ${b.remaining.toLocaleString("id-ID")}${b.remaining < 0 ? " (OVER BUDGET!)" : ""}`
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

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    max_tokens: 2048,
  })

  const summary = completion.choices[0]?.message?.content?.trim() ?? ""

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
