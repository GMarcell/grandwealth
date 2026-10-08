import { NextResponse } from "next/server"
import { requireUser } from "@/lib/api-access"
import { getAccessRecord } from "@/lib/account-access"
import { isAdminUser, isProUser, planLabel } from "@/lib/subscription"

/**
 * Structured response types so the frontend can render different message
 * kinds (plain text, feature card, quick replies, upgrade suggestion).
 */
export interface ChatResponse {
  message: string
  kind?: "text" | "feature" | "upgrade" | "help"
  /** Quick-reply chips the frontend can render as suggested next questions. */
  suggestions?: string[]
  /** Optional deep-link action the frontend can turn into a tappable card. */
  action?: { label: string; href: string; proOnly?: boolean }
}

const FREE_FEATURES = [
  { name: "Dashboard & net worth", href: "/dashboard", proOnly: false },
  { name: "Transactions", href: "/transactions", proOnly: false },
]

const PRO_FEATURES = [
  { name: "Monthly budgets", href: "/budgets", proOnly: true },
  { name: "Gold tracking", href: "/gold", proOnly: true },
  { name: "Stock portfolio", href: "/stocks", proOnly: true },
  { name: "Bank savings", href: "/savings", proOnly: true },
  { name: "Savings goals", href: "/goals", proOnly: true },
  { name: "Loans & debt", href: "/debts", proOnly: true },
  { name: "Recurring transactions", href: "/recurring", proOnly: true },
  { name: "Reports", href: "/reports", proOnly: true },
  { name: "AI monthly analysis", href: "/analysis", proOnly: true },
]

const FEATURE_KEYWORDS: Record<string, { href: string; label: string; proOnly: boolean }> = {
  budget: { href: "/budgets", label: "Monthly budgets", proOnly: true },
  budgets: { href: "/budgets", label: "Monthly budgets", proOnly: true },
  gold: { href: "/gold", label: "Gold tracking", proOnly: true },
  stock: { href: "/stocks", label: "Stock portfolio", proOnly: true },
  stocks: { href: "/stocks", label: "Stock portfolio", proOnly: true },
  saham: { href: "/stocks", label: "Stock portfolio", proOnly: true },
  savings: { href: "/savings", label: "Bank savings", proOnly: true },
  tabungan: { href: "/savings", label: "Bank savings", proOnly: true },
  goal: { href: "/goals", label: "Savings goals", proOnly: true },
  goals: { href: "/goals", label: "Savings goals", proOnly: true },
  target: { href: "/goals", label: "Savings goals", proOnly: true },
  debt: { href: "/debts", label: "Loans & debt", proOnly: true },
  debts: { href: "/debts", label: "Loans & debt", proOnly: true },
  pinjaman: { href: "/debts", label: "Loans & debt", proOnly: true },
  recurring: { href: "/recurring", label: "Recurring transactions", proOnly: true },
  otomatis: { href: "/recurring", label: "Recurring transactions", proOnly: true },
  report: { href: "/reports", label: "Reports", proOnly: true },
  reports: { href: "/reports", label: "Reports", proOnly: true },
  laporan: { href: "/reports", label: "Reports", proOnly: true },
  analysis: { href: "/analysis", label: "AI monthly analysis", proOnly: true },
  analyze: { href: "/analysis", label: "AI monthly analysis", proOnly: true },
  analisis: { href: "/analysis", label: "AI monthly analysis", proOnly: true },
  ai: { href: "/analysis", label: "AI monthly analysis", proOnly: true },
  dashboard: { href: "/dashboard", label: "Dashboard & net worth", proOnly: false },
  transaction: { href: "/transactions", label: "Transactions", proOnly: false },
  transactions: { href: "/transactions", label: "Transactions", proOnly: false },
  income: { href: "/transactions", label: "Transactions", proOnly: false },
  expenses: { href: "/transactions", label: "Transactions", proOnly: false },
  pengeluaran: { href: "/transactions", label: "Transactions", proOnly: false },
  pemasukan: { href: "/transactions", label: "Transactions", proOnly: false },
}

const GREETING_PATTERNS = [
  /^halo/i,
  /^hello/i,
  /^hai/i,
  /^hi/i,
  /^hey/i,
  /^selamat/i,
  /^(good\s+)?morning/i,
  /^(good\s+)?afternoon/i,
  /^(good\s+)?evening/i,
]

const HELP_PATTERNS = [
  /what\s+can\s+you\s+do/i,
  /what\s+do\s+you\s+do/i,
  /help/i,
  /bisa\s+bantu/i,
  /bantu/i,
  /fitur/i,
  /apa\s+saja/i,
  /yang\s+bisa/i,
]

const PLAN_PATTERNS = [
  /my\s+plan/i,
  /my\s+plan/i,
  /plan\s+status/i,
  /upgrade/i,
  /subscription/i,
  /my\s+features/i,
  /akun/i,
  /paket/i,
  /langganan/i,
  /upgrade/i,
  /pula/i,
]

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

export async function POST(request: Request) {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId

  const body = await request.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Messages are required" },
      { status: 400 },
    )
  }

  const user = await getAccessRecord(userId)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pro = isProUser(user)
  const admin = isAdminUser(user)
  const plan = planLabel(user.plan)

  const latest = String(messages.at(-1)?.content ?? "").trim()
  const text = latest.toLowerCase()

  // Last assistant message is available for follow-up context if needed
  // (e.g. interpreting "Where?" after we suggested a page).
  const _lastAssistant = messages
    .slice()
    .reverse()
    .find((m) => m.role === "assistant")?.content ?? ""

  // ── Intent classification ───────────────────────────────────────────

  // Greeting
  if (matchesAny(text, GREETING_PATTERNS)) {
    return NextResponse.json<ChatResponse>({
      kind: "help",
      message: pro
        ? `Halo! Kamu punya akses ${plan}. Saya bisa bantu cari fitur di GrandWealth, jelaskan dashboard, atau bantu kamu mulai dari mana.`
        : `Halo! Kamu lagi di paket ${plan}. Saya bisa bantu jelaskan fitur yang tersedia dan bantu kamu mulai menggunakan GrandWealth.`,
      suggestions: [
        "Apa saja fitur yang tersedia?",
        "Bagaimana cara menambah transaksi?",
        "Apa itu Pro?",
        "Bantu saya mulai",
      ],
    })
  }

  // Help / what can you do
  if (matchesAny(text, HELP_PATTERNS)) {
    const features = pro || admin ? [...FREE_FEATURES, ...PRO_FEATURES] : FREE_FEATURES
    const featureList = features
      .map((f) => `• [${f.name}](${f.href})`)
      .join("\n")
    return NextResponse.json<ChatResponse>({
      kind: "help",
      message: pro || admin
        ? `GrandWealth punya banyak fitur. Kamu bisa akses:\n\n${featureList}\n\nKetik nama fitur (mis. "budget", "gold", "saham") untuk langsung buka halamannya. Atau tanya apa saja yang mau kamu tahu.`
        : `GrandWealth punya dua fitur gratis:\n\n• [Dashboard & net worth](/dashboard)\n• [Transactions](/transactions)\n\nUntuk fitur lain seperti budget, emas, saham, dan laporan, kamu bisa upgrade ke Pro. Ketik nama fitur untuk mencoba buka halamannya.`,
      suggestions: pro || admin
        ? ["Bantu saya mulai", "Apa itu Pro?", "Budget", "Saham"]
        : ["Apa itu Pro?", "Upgrade", "Dashboard", "Transaksi"],
    })
  }

  // Plan / upgrade questions
  if (matchesAny(text, PLAN_PATTERNS)) {
    if (pro || admin) {
      const usedFeatures = messages
        .map((m) => String(m.content).toLowerCase())
        .filter((t) => Object.keys(FEATURE_KEYWORDS).some((k) => t.includes(k)))
      return NextResponse.json<ChatResponse>({
        kind: "text",
        message: admin
          ? `Kamu admin, jadi kamu punya akses penuh ke semua fitur termasuk yang khusus admin. Kamu bisa lihat semua pengguna dan kelola trial dari halaman admin.`
          : `Kamu sudah punya akses ${plan}. Fitur yang kamu gunakan: ${usedFeatures.length ? "kamu sudah pernah cari info tentang " + usedFeatures.join(", ") + "." : "belum ada catatan fitur yang kamu akses dari chat ini."} Kamu bisa langsung buka halamannya dari daftar fitur di atas.`,
        suggestions: [
          "Dashboard",
          "Budget",
          "Saham",
          "Laporan",
        ],
      })
    }
    return NextResponse.json<ChatResponse>({
      kind: "upgrade",
      message: `GrandWealth punya paket ${plan}.

**Paket gratis** mencakup Dashboard dan Transaksi.

**Pro** membuka: budgets, gold, stocks, savings, goals, debts, recurring, reports, dan AI analysis.

Kalau kamu mau coba fitur Pro, kamu bisa mulai dari halaman upgrade.`,
      action: { label: "Lihat upgrade", href: "/upgrade" },
      suggestions: [
        "Apa saja fitur Pro?",
        "Fitur gratis apa saja?",
        "Dashboard",
        "Transaksi",
      ],
    })
  }

  // Direct feature navigation request
  const matchedFeature = Object.entries(FEATURE_KEYWORDS).find(([, meta]) =>
    text.includes(meta.href.replace("/", "")) || text.includes(meta.label.toLowerCase().replace(/\s+/g, " ").slice(0, 6)),
  ) ?? Object.entries(FEATURE_KEYWORDS).find(([keyword]) => text.includes(keyword))

  if (matchedFeature) {
    const [, meta] = matchedFeature

    if (meta.proOnly && !pro && !admin) {
      return NextResponse.json<ChatResponse>({
        kind: "upgrade",
        message: `${meta.label} adalah fitur Pro. Kamu bisa coba fitur ini setelah upgrade ke Pro. Fitur gratis yang tersedia sekarang: Dashboard dan Transaksi.`,
        action: { label: meta.label, href: meta.href, proOnly: true },
        suggestions: [
          "Apa saja fitur Pro?",
          "Upgrade ke Pro",
          "Dashboard",
          "Transaksi",
        ],
      })
    }

    const followUpHints: Record<string, string[]> = {
      "/transactions": ["Tambah transaksi", "Cari transaksi", "Kategori"],
      "/budgets": ["Carrying over budget", "50/30/20", "Set budget"],
      "/gold": ["Harga emas", "Jurnal emas", "Nilai portofolio"],
      "/stocks": ["Harga saham", "Dividen", "Portofolio"],
      "/savings": ["Tabungan", "Hitung tabungan"],
      "/reports": ["Laporan bulan ini", "Kategori terbesar"],
      "/analysis": ["Analisis bulan lalu", "Generate analisis"],
      "/goals": ["Buat goal", "Progress goal"],
      "/debts": ["Hitung hutang", "Cek sisa hutang"],
      "/recurring": ["Buat otomatis", "Cek yang otomatis"],
      "/dashboard": ["Nilai total", "Cash flow", "Budget"],
    }

    const hints = followUpHints[meta.href] ?? ["Bantuan", "Fitur lain"]

    return NextResponse.json<ChatResponse>({
      kind: "feature",
      message: `Oke, ini halaman ${meta.label}.

Kamu bisa buka langsung: [${meta.label}](${meta.href}).`,
      action: { label: meta.label, href: meta.href },
      suggestions: hints,
    })
  }

  // Navigation phrases: "open / go to / buka / pergi ke / to sheet"
  const openMatch = latest.match(/(?:open|buka|ke|go\s+to|pergi\s+ke|caripun?)\s+([a-z0-9\s-]+)/i)
  if (openMatch) {
    const query = openMatch[1].trim().toLowerCase()
    const byQuery = Object.entries(FEATURE_KEYWORDS).find(([, meta]) =>
      meta.href.includes(query) ||
      meta.label.toLowerCase().includes(query) ||
      meta.label.toLowerCase().replace(/\s+/g, "").includes(query.replace(/\s+/g, "")),
    )
    if (byQuery) {
      const [, meta] = byQuery
      if (meta.proOnly && !pro && !admin) {
        return NextResponse.json<ChatResponse>({
          kind: "upgrade",
          message: `${meta.label} adalah fitur Pro. Kamu bisa buka setelah upgrade. Fitur gratis: Dashboard dan Transaksi.`,
          action: { label: meta.label, href: meta.href, proOnly: true },
          suggestions: ["Upgrade ke Pro", "Fitur gratis apa saja?"],
        })
      }
      return NextResponse.json<ChatResponse>({
        kind: "feature",
        message: `Baik, saya buka ${meta.label} untuk kamu.

${meta.href}`,
        action: { label: meta.label, href: meta.href },
        suggestions: ["Bantuan", "Fitur lain"],
      })
    }
  }

  // Fallback: contextual default
  const defaultMessage = pro || admin
    ? `Saya bisa bantu cari fitur di GrandWealth. Coba tanya tentang budget, emas, saham, tabungan, laporan, dashboard, atau transaksi. Atau ketik "bantuan" untuk lihat semua fitur. Kamu lagi di ${plan}.`
    : `Saya bisa bantu jawab pertanyaan tentang GrandWealth. Coba tanya tentang dashboard, transaksi, atau fitur Pro seperti budget, emas, saham, dan laporan. Kamu lagi di ${plan}.`

  return NextResponse.json<ChatResponse>({
    kind: "text",
    message: defaultMessage,
    suggestions: [
      "Apa saja fitur yang tersedia?",
      "Bantuan",
      pro || admin ? "Budget" : "Upgrade",
      "Dashboard",
    ],
  })
}
