/**
 * Client-side report export helpers (Excel + PDF).
 *
 * Both libraries are dynamically imported so they only load when the user
 * actually clicks an export button.
 */

export interface ReportExportData {
  summary: {
    totalIncome: number
    totalExpenses: number
    netCashflow: number
    avgMonthlyIncome: number
    avgMonthlyExpenses: number
    avgMonthlyNet: number
    monthsInRange: number
    totalTransactions: number
  }
  monthlyBreakdown: Array<{
    month: string
    label: string
    income: number
    expenses: number
    net: number
    transactionCount: number
  }>
  categoryBreakdown: {
    income: Array<{ category: string; total: number }>
    expense: Array<{ category: string; total: number }>
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Excel ─────────────────────────────────────

export async function exportReportExcel(data: ReportExportData): Promise<void> {
  const XLSX = await import("xlsx")

  const wb = XLSX.utils.book_new()

  // Summary sheet
  const s = data.summary
  const summaryRows: Array<Array<string | number>> = [
    ["GrandWealth Financial Report"],
    [],
    ["Report period", `${s.monthsInRange} months`],
    ["Total income", s.totalIncome],
    ["Total expenses", s.totalExpenses],
    ["Net cash flow", s.netCashflow],
    ["Average monthly income", s.avgMonthlyIncome],
    ["Average monthly expenses", s.avgMonthlyExpenses],
    ["Average monthly net", s.avgMonthlyNet],
    ["Transactions", s.totalTransactions],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary["!cols"] = [{ wch: 28 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary")

  // Monthly breakdown sheet
  const wsMonthly = XLSX.utils.json_to_sheet(
    data.monthlyBreakdown.map((m) => ({
      Month: m.label,
      Income: m.income,
      Expenses: m.expenses,
      Net: m.net,
      Transactions: m.transactionCount,
    }))
  )
  wsMonthly["!cols"] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Monthly Breakdown")

  // Category breakdown sheets
  const wsExpense = XLSX.utils.json_to_sheet(
    data.categoryBreakdown.expense.map((c) => ({
      Category: c.category.replace("_", " "),
      Amount: c.total,
    }))
  )
  wsExpense["!cols"] = [{ wch: 24 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsExpense, "Expenses by Category")

  const wsIncome = XLSX.utils.json_to_sheet(
    data.categoryBreakdown.income.map((c) => ({
      Category: c.category.replace("_", " "),
      Amount: c.total,
    }))
  )
  wsIncome["!cols"] = [{ wch: 24 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, wsIncome, "Income by Category")

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  downloadBlob(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `grandwealth-report-${fileStamp()}.xlsx`
  )
}

// ─── PDF ───────────────────────────────────────

export async function exportReportPdf(data: ReportExportData): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4 portrait
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const WIDTH = page.getWidth()
  const MARGIN = 48
  const INDIGO = rgb(0.39, 0.4, 0.95)
  const DARK = rgb(0.11, 0.11, 0.12)
  const GRAY = rgb(0.45, 0.45, 0.48)
  const RED = rgb(0.9, 0.25, 0.25)
  const GREEN = rgb(0.06, 0.72, 0.51)

  let y = page.getHeight() - 64

  // Title
  page.drawText("GrandWealth Financial Report", {
    x: MARGIN,
    y,
    size: 22,
    font: bold,
    color: INDIGO,
  })
  y -= 26
  page.drawText(`Generated ${new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: GRAY,
  })
  y -= 16
  page.drawText(`Period: last ${data.summary.monthsInRange} months · ${data.summary.totalTransactions} transactions`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: GRAY,
  })

  y -= 40

  const fmt = (v: number) =>
    "Rp " + Math.round(v).toLocaleString("id-ID")

  // Key stats
  const stats: Array<[string, string, typeof DARK]> = [
    ["Total Income", fmt(data.summary.totalIncome), GREEN],
    ["Total Expenses", fmt(data.summary.totalExpenses), RED],
    ["Net Cash Flow", fmt(data.summary.netCashflow), DARK],
    ["Avg Monthly Net", fmt(data.summary.avgMonthlyNet), DARK],
  ]

  const statColWidth = (WIDTH - MARGIN * 2) / 2
  stats.forEach(([label, value, color], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = MARGIN + col * statColWidth
    const yy = y - row * 52
    page.drawText(label, { x, y: yy, size: 9, font, color: GRAY })
    page.drawText(value, { x, y: yy - 16, size: 13, font: bold, color })
  })

  y -= stats.length / 2 * 52 + 24

  // Monthly breakdown table
  page.drawText("Monthly Breakdown", {
    x: MARGIN,
    y,
    size: 13,
    font: bold,
    color: DARK,
  })
  y -= 22

  const cols = [
    { label: "Month", width: 110, align: "left" as const },
    { label: "Income", width: 130, align: "right" as const },
    { label: "Expenses", width: 130, align: "right" as const },
    { label: "Net", width: 130, align: "right" as const },
  ]

  const colX = (i: number) =>
    MARGIN + cols.slice(0, i).reduce((sum, c) => sum + c.width, 0)

  // Header row
  cols.forEach((c, i) => {
    page.drawText(c.label, {
      x: c.align === "right" ? colX(i) + c.width - 4 : colX(i),
      y,
      size: 9,
      font: bold,
      color: INDIGO,
    })
  })
  y -= 10
  page.drawLine({
    start: { x: MARGIN, y: y + 2 },
    end: { x: WIDTH - MARGIN, y: y + 2 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.9),
  })

  const maxRows = 26
  for (const m of data.monthlyBreakdown.slice(0, maxRows)) {
    y -= 18
    const values = [m.label, fmt(m.income), fmt(m.expenses), fmt(m.net)]
    cols.forEach((c, i) => {
      page.drawText(values[i], {
        x: c.align === "right" ? colX(i) + c.width - 4 : colX(i),
        y,
        size: 9,
        font: i === 3 ? bold : font,
        color: i === 3 ? (m.net >= 0 ? GREEN : RED) : DARK,
      })
    })
  }

  y -= 28
  page.drawText(
    "Category breakdowns are available in the Excel export.",
    { x: MARGIN, y, size: 9, font, color: GRAY }
  )

  const bytes = await doc.save()
  downloadBlob(
    new Blob([bytes as unknown as ArrayBuffer], { type: "application/pdf" }),
    `grandwealth-report-${fileStamp()}.pdf`
  )
}
