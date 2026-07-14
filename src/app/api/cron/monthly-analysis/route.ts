import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

/**
 * Cron endpoint to generate a monthly spending & savings analysis for every user
 * using Groq AI. Intended to run at the end of each calendar month.
 *
 * Setup options:
 *   - **Vercel Cron Jobs**: Set CRON_SECRET & GROQ_API_KEY env vars in Vercel dashboard.
 *   - **Linux cron**: `curl -H "Authorization: Bearer YOUR_SECRET" https://yourdomain.com/api/cron/monthly-analysis`
 *   - **Cron-job.org, etc**: Pass as query param `?secret=YOUR_SECRET`
 *
 * Schedule: Runs on the last day of every month at 23:30 UTC.
 *   cron: "30 23 28-31 * *" (Vercel will run it only on the last day)
 */
export async function GET(request: Request) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null
    const url = new URL(request.url)
    const querySecret = url.searchParams.get("secret")
    const providedSecret = bearerToken ?? querySecret

    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // Check for Groq API key
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    // Determine the month to analyze (the month that just ended).
    // The cron runs at 23:30 on the last calendar day of the month.
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // Month range: first day to last day of the current month (which is ending)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, budgetStartDay: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ message: "No users found", count: 0 })
    }

    let analyzedCount = 0
    const errors: Array<{ userId: string; error: string }> = []

    for (const user of users) {
      try {
        // ── Fetch user's monthly data ──

        // Transactions for the month
        const transactions = await prisma.transaction.findMany({
          where: {
            userId: user.id,
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
          where: { userId: user.id, month: monthKey },
        })

        const budgetMap = new Map(budgets.map((b) => [b.categoryName, b]))
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
          where: { userId: user.id },
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
          const price = stock.currentPrice ?? stock.buyPrice
          const value = price * stock.quantity
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
          where: { userId: user.id },
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

        const systemPrompt = `You are a friendly, professional personal financial analyst and savings coach. Your primary focus is helping users save more money and build wealth. Your job is to analyze a user's monthly financial data and provide insightful, actionable analysis in Indonesian/Bahasa Indonesia — with a strong emphasis on savings opportunities and recommendations.

Write a monthly financial analysis report in Markdown format. The report MUST cover:

1. **Ringkasan Bulanan** (Monthly Summary) — key figures: income, expenses, savings, savings rate
2. **Skor Kesehatan Tabungan** (Savings Health Score) — assessment of their savings rate compared to the 20% target:
   - 20%+ → "Excellent — you're building wealth!" 
   - 10-20% → "Good progress — let's push higher"
   - 0-10% → "Room for improvement — here's how"
   - Negative → "Need to turn this around — urgent action needed"
3. **Analisis Pengeluaran** (Spending Analysis) — top spending categories, where money leaks, and specific savings opportunities in each category
4. **Potensi Penghematan** (Savings Opportunities) — CRITICAL section: calculate and present concrete saving ideas:
   - Identify ONE or TWO categories where cutting back 10-20% would make the biggest impact
   - Show the math: "If you reduce ${topCategory} spending by 15%, you'd save Rp X per month = Rp Y per year"
   - Suggest cheaper alternatives or spending swaps
5. **Kinerja Anggaran** (Budget Performance) — how well budgets were followed, overruns
6. **Tabungan & Investasi** (Savings & Investments) — savings rate, stock & gold holdings, how to rebalance for better returns
7. **Rekomendasi Tabungan** (Savings Recommendations) — 3-4 SPECIFIC, actionable tips for next month:
   - Be concrete: include numbers (e.g., "Try saving Rp 500.000 more per month by...")
   - Prioritize the highest-impact changes
   - Suggest an actionable saving challenge (e.g., "50/30/20 rule", "no-spend weekend", "automatic transfer to savings")

CRITICAL: At least 40% of the report must focus on actionable savings strategies. Be encouraging but honest. Use Indonesian language (Bahasa). Format with Markdown headings and bullet points. Keep it engaging and personalized.`

        const userPrompt = `Buat analisis keuangan bulanan untuk ${user.name || "pengguna"} untuk bulan ${monthKey}. FOKUS pada rekomendasi tabungan dan cara menghemat lebih banyak.

Data keuangan bulan ini:
- Total Pendapatan: Rp ${totalIncome.toLocaleString("id-ID")}
- Total Pengeluaran: Rp ${totalExpenses.toLocaleString("id-ID")}
- Tabungan Bersih: Rp ${netSavings.toLocaleString("id-ID")}
- Rasio Tabungan: ${savingsRate.toFixed(1)}%
- Jumlah Transaksi: ${transactions.length} (${incomeTxs.length} pemasukan, ${expenseTxs.length} pengeluaran)

Pengeluaran per Kategori (dari terbesar ke terkecil):
${sortedSpending.map((s) => `- ${s.category}: Rp ${s.total.toLocaleString("id-ID")} (${totalExpenses > 0 ? ((s.total / totalExpenses) * 100).toFixed(1) : 0}% dari total)`).join("\n")}

Pendapatan per Kategori:
${sortedIncome.map((s) => `- ${s.category}: Rp ${s.total.toLocaleString("id-ID")}`).join("\n")}

Anggaran Bulanan:
${budgetDetails.map((b) => `- ${b.category}: anggaran Rp ${b.budgeted.toLocaleString("id-ID")}, terpakai Rp ${b.spent.toLocaleString("id-ID")}, sisa Rp ${b.remaining.toLocaleString("id-ID")}${b.remaining < 0 ? " (OVER BUDGET!)" : ""}`).join("\n") || "Tidak ada anggaran yang ditetapkan."}

Portofolio Saham:
${stockDetails.map((s) => `- ${s.symbol} (${s.name}): ${s.quantity} lembar @ Rp ${s.currentPrice?.toLocaleString("id-ID") ?? s.buyPrice.toLocaleString("id-ID")} = Rp ${s.value.toLocaleString("id-ID")}`).join("\n") || "Tidak ada kepemilikan saham."}

${totalGoldWeight > 0 ? `Emas: ${totalGoldWeight.toFixed(2)} gram, nilai Rp ${totalGoldValue.toLocaleString("id-ID")}` : "Tidak ada kepemilikan emas."}

BERIKAN LANGKAH-LANGKAH HEMAT YANG SPESIFIK DAN BISA DILAKUKAN. Hitung potensi penghematan dalam Rupiah. Beri saran tabungan yang konkret. Gunakan Bahasa Indonesia dengan format Markdown.`

        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 2048,
        })

        const summary = completion.choices[0]?.message?.content?.trim() ?? ""

        // ── Store analysis in database ──

        await prisma.monthlyAnalysis.upsert({
          where: {
            month_userId: {
              month: monthKey,
              userId: user.id,
            },
          },
          update: {
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
          },
          create: {
            month: monthKey,
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
            userId: user.id,
          },
        })

        analyzedCount++
      } catch (userError) {
        console.error(`Error analyzing for user ${user.id}:`, userError)
        errors.push({
          userId: user.id,
          error: userError instanceof Error ? userError.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      message: `Monthly analysis generated for ${analyzedCount} users`,
      month: monthKey,
      count: analyzedCount,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Cron monthly analysis error:", error)
    return NextResponse.json(
      { error: "Failed to generate monthly analysis" },
      { status: 500 }
    )
  }
}
