import { NextResponse } from "next/server"
import { requireUser } from "@/lib/api-access"
import { getAccessRecord } from "@/lib/account-access"
import { isAdminUser, isProUser, planLabel } from "@/lib/subscription"
import { prisma } from "@/lib/prisma"
import { PREDEFINED_INCOME, PREDEFINED_EXPENSE } from "@/const/transaction"

/** Structured response types for the chatbot frontend. */
export interface ChatResponse {
  message: string
  kind?: "text" | "feature" | "upgrade" | "help" | "prompt"
  /** Quick-reply chips the frontend can render as suggested next answers. */
  suggestions?: string[]
  /** When kind is "prompt", the frontend asks for this field. */
  field?: string
  /** Optional deep-link action the frontend can render as a tappable card. */
  action?: { label: string; href: string; proOnly?: boolean }
}

/** Short-lived per-conversation state, stored in the last assistant message. */
export interface ChatState {
  flow: "greeting" | "help" | "plan" | "feature" | "add-transaction-field" | "idle"
  command?: string
  data?: Record<string, unknown>
  field?: string
  suggestions?: string[]
  userCategories?: UserCategory[]
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
  savings: { href: "/savings", label: "Bank savings", proOnly: true },
  goal: { href: "/goals", label: "Savings goals", proOnly: true },
  goals: { href: "/goals", label: "Savings goals", proOnly: true },
  target: { href: "/goals", label: "Savings goals", proOnly: true },
  debt: { href: "/debts", label: "Loans & debt", proOnly: true },
  debts: { href: "/debts", label: "Loans & debt", proOnly: true },
  recurring: { href: "/recurring", label: "Recurring transactions", proOnly: true },
  report: { href: "/reports", label: "Reports", proOnly: true },
  reports: { href: "/reports", label: "Reports", proOnly: true },
  analysis: { href: "/analysis", label: "AI monthly analysis", proOnly: true },
  analyze: { href: "/analysis", label: "AI monthly analysis", proOnly: true },
  ai: { href: "/analysis", label: "AI monthly analysis", proOnly: true },
  dashboard: { href: "/dashboard", label: "Dashboard & net worth", proOnly: false },
  transaction: { href: "/transactions", label: "Transactions", proOnly: false },
  transactions: { href: "/transactions", label: "Transactions", proOnly: false },
  income: { href: "/transactions", label: "Transactions", proOnly: false },
  expenses: { href: "/transactions", label: "Transactions", proOnly: false },
}

const GREETING_PATTERNS = [
  /^hello/i,
  /^hai/i,
  /^hi/i,
  /^hey/i,
  /^(good\s+)?morning/i,
  /^(good\s+)?afternoon/i,
  /^(good\s+)?evening/i,
]

const HELP_PATTERNS = [
  /what\s+can\s+you\s+do/i,
  /what\s+do\s+you\s+do/i,
  /help/i,
  /features/i,
  /what\s+do\s+i\s+have/i,
  /available/i,
  /capabilities/i,
]

const PLAN_PATTERNS = [
  /my\s+plan/i,
  /plan\s+status/i,
  /upgrade/i,
  /subscription/i,
  /my\s+features/i,
  /account\s+type/i,
  /plan\s+type/i,
  /which\s+plan/i,
  /what\s+plan/i,
  /package/i,
]

const CANCEL_PATTERNS = [
  /^(cancel|never\s?mind|stop|quit|exit|abort|forget it|batal(kan)?|gak jadi|ga jadi|udahan)$/i,
]

const UNDO_PATTERNS = [
  /^(undo|undo that|undo last|undo last transaction|batalkan yang tadi|batalin yang tadi)$/i,
]

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

/**
 * Try to parse an "add transaction" command from free text.
 *
 * Supported shapes:
 *   add transaction 10000
 *   add expense 10000
 *   add income 10000
 *   add transaction 10000 expense
 *   add transaction 10000 income
 *   add transaction 10000 food lunch with team   (category + notes)
 *   add transaction -10000                        (negative -> expense)
 */
export interface ParsedAddTransaction {
  type?: "INCOME" | "EXPENSE"
  amount?: number
  /** Text after the amount, e.g. "Groceries lunch with team". */
  remainder?: string
}

const TRANSACTION_TYPE_WORDS = new Set([
  "expense",
  "income",
  "receipt",
  "spending",
  "spend",
  "send",
  "receive",
  "pemasukan",
  "pengeluaran",
])

function parseAddTransaction(text: string): ParsedAddTransaction | null {
  const cleaned = text
    .replace(/[_\u2010-\u2015]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // A bare "add transaction" / "add another transaction" with no amount yet —
  // start a fresh flow and ask for the details.
  const bareMatch = cleaned.match(
    /^(?:add|new|create|input)\s+(?:another\s+)?(transaction|expense|income|receipt|spending|spend|pemasukan|pengeluaran)$/i,
  )
  if (bareMatch) {
    const noun = bareMatch[1].toLowerCase()
    return noun === "transaction" ? {} : { type: typeWordMatch(noun) }
  }

  const addMatch = cleaned.match(
    /^(?:add|new|create|input)\s+(transaction|expense|income|receipt|spending|spend|pemasukan|pengeluaran)\s+(.+)$/i,
  )
  if (!addMatch) return null

  const [, commandWord, rest] = addMatch
  const command = commandWord.toLowerCase()
  const tokens = rest.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null

  let type: "INCOME" | "EXPENSE" | undefined =
    command === "transaction" ? undefined : typeWordMatch(command)

  let amount: number | undefined
  let index = 0

  const firstAmount = parseAmount(tokens[0])
  if (firstAmount != null) {
    amount = firstAmount
    index = 1
  } else if (TRANSACTION_TYPE_WORDS.has(tokens[0].toLowerCase()) && tokens[1] != null) {
    // "add transaction expense 10000"
    type = typeWordMatch(tokens[0])
    const afterType = parseAmount(tokens[1])
    if (afterType == null) return null
    amount = afterType
    index = 2
  } else {
    return null
  }

  // "add transaction -10000" infers an expense.
  const rawNum = Number(tokens[0].replace(/[,\s]/g, ""))
  if (Number.isFinite(rawNum) && rawNum < 0) type = "EXPENSE"

  let tail = tokens.slice(index)

  // A trailing type word right after the amount: "add transaction 10000 expense".
  if (type == null && tail.length > 0 && TRANSACTION_TYPE_WORDS.has(tail[0].toLowerCase())) {
    type = typeWordMatch(tail[0])
    tail = tail.slice(1)
  }

  const remainder = tail.join(" ").trim()
  return {
    ...(type ? { type } : {}),
    ...(amount != null ? { amount } : {}),
    ...(remainder ? { remainder } : {}),
  }
}

function typeWordMatch(word: string): "INCOME" | "EXPENSE" {
  const w = word.toLowerCase()
  if (w === "income" || w === "receipt" || w === "receive" || w === "pemasukan") return "INCOME"
  return "EXPENSE"
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Interpret text after the amount as "<category> [notes]", using the user's
 * existing categories for the transaction type. Returns null when the text
 * doesn't begin with a known category name.
 */
function resolveCategoryFromRemainder(
  remainder: string,
  options: string[],
): { category: string; notes?: string } | null {
  const trimmed = remainder.trim()
  if (!trimmed) return null

  // Prefer the longest matching category so "other expense" beats "other".
  const longestFirst = [...options].sort(
    (a, b) => normalizeCategoryName(b).length - normalizeCategoryName(a).length,
  )
  for (const option of longestFirst) {
    const pattern = option.split(/[_\s]+/).map(escapeRegExp).join("[_\\s]+")
    const match = trimmed.match(new RegExp(`^${pattern}(?=$|[_\\s])`, "i"))
    if (match) {
      const notes = trimmed.slice(match[0].length).trim()
      return { category: option, ...(notes ? { notes } : {}) }
    }
  }
  return null
}

/**
 * Resolve the "category [notes]" tail of a one-shot command once the type is
 * known. No-op when there's nothing to resolve or the category isn't found.
 */
function applyRemainder(
  data: Record<string, unknown>,
  userCategories: UserCategory[],
): void {
  const remainder = typeof data.remainder === "string" ? data.remainder : undefined
  if (!remainder || data.category != null) return

  const type =
    data.type === "INCOME" ? "INCOME" : data.type === "EXPENSE" ? "EXPENSE" : undefined
  if (!type) return

  const resolved = resolveCategoryFromRemainder(
    remainder,
    categoryOptionsForType(userCategories, type),
  )
  if (!resolved) return

  data.category = resolved.category
  if (resolved.notes && data.notes == null) data.notes = resolved.notes
  data.oneShot = true
  delete data.remainder
}

/**
 * Normalize a user-typed amount to a plain number string. Handles both the
 * Indonesian format ("10.000" -> "10000", "1.500,50" -> "1500.50") and the
 * English one ("10,000" -> "10000", "1,500.50" -> "1500.50").
 */
function normalizeAmountString(raw: string): string | null {
  // Strip currency symbols/spaces, keep digits, separators and a sign.
  const value = raw.trim().replace(/[^\d.,+-]/g, "")
  if (!value || !/\d/.test(value)) return null

  const lastDot = value.lastIndexOf(".")
  const lastComma = value.lastIndexOf(",")

  let decimalSep: "." | "," | null = null
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: the last one is the decimal separator.
    decimalSep = lastDot > lastComma ? "." : ","
  } else if (lastComma !== -1) {
    // Only commas: a decimal separator if 1-2 digits follow, else thousands.
    const after = value.length - lastComma - 1
    decimalSep = after === 1 || after === 2 ? "," : null
  } else if (lastDot !== -1) {
    const after = value.length - lastDot - 1
    decimalSep = after === 1 || after === 2 ? "." : null
  }

  if (decimalSep === ".") {
    return value.split(",").join("")
  }
  if (decimalSep === ",") {
    return value.split(".").join("").replace(/,/g, ".")
  }
  // No decimal separator: every dot/comma is a thousands separator.
  return value.replace(/[.,]/g, "")
}

function parseAmount(raw: string): number | null {
  const normalized = normalizeAmountString(raw)
  if (normalized == null) return null
  const n = Number(normalized)
  if (!Number.isFinite(n) || n === 0) return null
  return Math.abs(n)
}

/** A category available to a user, as stored in the Category table. */
export interface UserCategory {
  name: string
  type: string
}

/** Normalize a category name for matching ("OTHER EXPENSE" === "other_expense"). */
function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/[_\s]+/g, " ")
}

/** Format a category name for display: "OTHER_EXPENSE" -> "Other expense". */
function formatCategoryOption(name: string): string {
  const spaced = name.replace(/_/g, " ").trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/**
 * Categories a transaction of `type` can use: the app's predefined income or
 * expense list plus the user's own categories of that type. This mirrors the
 * category dropdown on the Transactions page so the chatbot only ever writes
 * an existing category.
 */
function categoryOptionsForType(
  userCategories: UserCategory[] | undefined,
  type: "INCOME" | "EXPENSE",
): string[] {
  const predefined: readonly string[] =
    type === "INCOME" ? PREDEFINED_INCOME : PREDEFINED_EXPENSE
  const seen = new Set(predefined.map(normalizeCategoryName))
  const userNames = (userCategories ?? [])
    .filter((c) => c.type === type)
    .map((c) => c.name)
    .filter((name) => !seen.has(normalizeCategoryName(name)))
  return [...predefined, ...userNames]
}

/** Human-friendly suggestions for the category prompt. */
function categorySuggestions(options: string[]): string[] {
  return options.slice(0, 6).map(formatCategoryOption)
}

function transactionPrompt(
  fields: {
    type?: "INCOME" | "EXPENSE"
    amount?: number
    category?: string
    notes?: string
  },
  userCategories?: UserCategory[],
): ChatResponse {
  // Ask for the type first when the user didn't already imply it.
  if (fields.type == null) {
    return {
      kind: "prompt",
      message: "Got it. Is this an expense or an income?",
      field: "type",
      suggestions: ["Expense", "Income"],
    }
  }

  if (fields.amount == null) {
    return {
      kind: "prompt",
      message: "Got it. How much is the transaction? (For example: 10000 or -5000)",
      field: "amount",
      suggestions: ["10000", "50000", "100000"],
    }
  }

  if (fields.category == null) {
    return {
      kind: "prompt",
      message: `Okay, ${fields.type === "INCOME" ? "income" : "expense"} of ${formatAmount(fields.amount)}. Which category should I use?`,
      field: "category",
      suggestions: categorySuggestions(
        categoryOptionsForType(userCategories, fields.type),
      ),
    }
  }

  return {
    kind: "prompt",
    message: `Nice. Category: ${fields.category}. Anything else I should note? (Reply with a note, or just say "no".)`,
    field: "notes",
    suggestions: ["No", "Yes, add a note"],
  }
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount)
}

function jsonResponse(response: ChatResponse, state?: ChatState): NextResponse {
  const body: Record<string, unknown> = { ...response }
  if (state) {
    body._state = state
  }
  return NextResponse.json(body)
}

export async function POST(request: Request) {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId

  const body = await request.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages are required" }, { status: 400 })
  }

  const user = await getAccessRecord(userId)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pro = isProUser(user)
  const admin = isAdminUser(user)
  const plan = planLabel(user.plan)

  const latestText = String(messages.at(-1)?.content ?? "").trim()
  const text = latestText.toLowerCase()

  const lastAssistant = messages
    .slice()
    .reverse()
    .find(
      (m) => m.role === "assistant" && (m as { _state?: ChatState })._state != null,
    ) as { role: "assistant"; content: string; _state?: ChatState } | undefined

  const state: ChatState = lastAssistant?._state ?? { flow: "idle" }

  // Undo a transaction the bot created earlier in this conversation. The id is
  // carried in the state of the last assistant message.
  if (matchesAny(text, UNDO_PATTERNS)) {
    const lastId = state.data?.lastTransactionId
    if (typeof lastId === "string") {
      return undoLastTransaction(userId, lastId)
    }
    return jsonResponse(
      {
        kind: "text",
        message: "There's nothing to undo right now.",
        suggestions: ["add expense 10000", "Help"],
      },
      { flow: "idle" },
    )
  }

  // Cancel an in-progress multi-step flow without saving anything.
  if (matchesAny(text, CANCEL_PATTERNS)) {
    if (state.flow === "add-transaction-field") {
      return jsonResponse(
        {
          kind: "text",
          message: "No problem — I've cancelled that. Nothing was saved.",
          suggestions: ["add expense 10000", "add income 10000"],
        },
        { flow: "idle" },
      )
    }
    return jsonResponse(
      {
        kind: "text",
        message: "There's nothing in progress to cancel.",
        suggestions: ["Help", "Dashboard"],
      },
      { flow: "idle" },
    )
  }

  // Resume a multi-step flow first.
  if (state.flow === "add-transaction-field" && state.data) {
    const resumed = await continueAddTransactionFlow(userId, state, latestText)
    if (resumed) return resumed
  }

  // Greeting.
  if (matchesAny(text, GREETING_PATTERNS)) {
    const newState: ChatState = { flow: "greeting" }
    return jsonResponse(
      {
        kind: "help",
        message: pro
          ? `Hi! You have ${plan} access. I can help you find features in GrandWealth, explain the dashboard, or help you get started.`
          : `Hi! You're on the ${plan} plan. I can help explain the available features and help you start using GrandWealth.`,
        suggestions: [
          "What features are available?",
          "How do I add a transaction?",
          "What is Pro?",
          "Help me get started",
        ],
      },
      newState,
    )
  }

  // Help.
  if (matchesAny(text, HELP_PATTERNS)) {
    const features = pro || admin ? [...FREE_FEATURES, ...PRO_FEATURES] : FREE_FEATURES
    const featureList = features.map((f) => `• [${f.name}](${f.href})`).join("\n")
    const newState: ChatState = { flow: "help" }
    return jsonResponse(
      {
        kind: "help",
        message: pro || admin
          ? `GrandWealth has many features. You can access:\n\n${featureList}\n\nType a feature name (e.g. "budget", "gold", "stocks") to open it directly. Or ask me anything you'd like to know.`
          : `GrandWealth has two free features:\n\n• [Dashboard & net worth](/dashboard)\n• [Transactions](/transactions)\n\nFor features like budgets, gold, stocks, and reports, you can upgrade to Pro. Type a feature name to try opening it.`,
        suggestions: pro || admin
          ? ["Help me get started", "What is Pro?", "Budget", "Stocks"]
          : ["What is Pro?", "Upgrade", "Dashboard", "Transactions"],
      },
      newState,
    )
  }

  // Plan / upgrade.
  if (matchesAny(text, PLAN_PATTERNS)) {
    if (pro || admin) {
      const usedFeatures = messages
        .map((m) => String(m.content).toLowerCase())
        .filter((t) => Object.keys(FEATURE_KEYWORDS).some((k) => t.includes(k)))
      const newState: ChatState = { flow: "plan" }
      return jsonResponse(
        {
          kind: "text",
          message: admin
            ? `You're an admin, so you have full access to all features including admin-only ones. You can view all users and manage trials from the admin page.`
            : `You already have ${plan} access. Features you've asked about: ${usedFeatures.length ? "you've previously asked about " + usedFeatures.join(", ") + "." : "no features have been mentioned in this chat yet."} You can open any of them from the feature list above.`,
          suggestions: ["Dashboard", "Budget", "Stocks", "Reports"],
        },
        newState,
      )
    }
    const newState: ChatState = { flow: "plan" }
    return jsonResponse(
      {
        kind: "upgrade",
        message: `GrandWealth has the ${plan} plan.\n\n**Free plan** includes Dashboard and Transactions.\n\n**Pro** unlocks: budgets, gold, stocks, savings, goals, debts, recurring, reports, and AI analysis.\n\nIf you want to try Pro features, you can start from the upgrade page.`,
        action: { label: "View upgrade", href: "/upgrade" },
        suggestions: [
          "What Pro features are there?",
          "What free features are there?",
          "Dashboard",
          "Transactions",
        ],
      },
      newState,
    )
  }

  // "add transaction …" command.
  const addTx = parseAddTransaction(latestText)
  if (addTx) {
    return startAddTransactionFlow(userId, addTx)
  }

  // Direct feature navigation.
  const matchedFeature = Object.entries(FEATURE_KEYWORDS).find(
    ([, meta]) =>
      text.includes(meta.href.replace("/", "")) ||
      text.includes(meta.label.toLowerCase().replace(/\s+/g, " ").slice(0, 6)),
  ) ?? Object.entries(FEATURE_KEYWORDS).find(([keyword]) => text.includes(keyword))

  if (matchedFeature) {
    const [, meta] = matchedFeature
    if (meta.proOnly && !pro && !admin) {
      const newState: ChatState = { flow: "feature" }
      return jsonResponse(
        {
          kind: "upgrade",
          message: `${meta.label} is a Pro feature. You can try it after upgrading to Pro. Free features available now: Dashboard and Transactions.`,
          action: { label: meta.label, href: meta.href, proOnly: true },
          suggestions: [
            "What Pro features are there?",
            "Upgrade to Pro",
            "Dashboard",
            "Transactions",
          ],
        },
        newState,
      )
    }

    const followUpHints: Record<string, string[]> = {
      "/transactions": ["Add a transaction", "Search transactions", "Categories"],
      "/budgets": ["Carrying over budget", "50/30/20", "Set a budget"],
      "/gold": ["Gold price", "Gold journal", "Portfolio value"],
      "/stocks": ["Stock price", "Dividends", "Portfolio"],
      "/savings": ["Savings", "Calculate savings"],
      "/reports": ["This month's report", "Top category"],
      "/analysis": ["Last month's analysis", "Generate analysis"],
      "/goals": ["Create a goal", "Goal progress"],
      "/debts": ["Calculate debt", "Check remaining debt"],
      "/recurring": ["Create recurring", "Check recurring"],
      "/dashboard": ["Total net worth", "Cash flow", "Budget"],
    }

    const hints = followUpHints[meta.href] ?? ["Help", "Other features"]
    const newState: ChatState = { flow: "feature" }
    return jsonResponse(
      {
        kind: "feature",
        message: `Here's the ${meta.label} page.\n\nYou can open it directly: [${meta.label}](${meta.href}).`,
        action: { label: meta.label, href: meta.href },
        suggestions: hints,
      },
      newState,
    )
  }

  // "open / go to / ke / pergi ke / caripun?" navigation.
  const openMatch = latestText.match(/(?:open|buka|ke|go\s+to|pergi\s+ke|caripun?)\s+([a-z0-9\s-]+)/i)
  if (openMatch) {
    const query = openMatch[1].trim().toLowerCase()
    const byQuery = Object.entries(FEATURE_KEYWORDS).find(
      ([, meta]) =>
        meta.href.includes(query) ||
        meta.label.toLowerCase().includes(query) ||
        meta.label.toLowerCase().replace(/\s+/g, "").includes(query.replace(/\s+/g, "")),
    )
    if (byQuery) {
      const [, meta] = byQuery
      if (meta.proOnly && !pro && !admin) {
        const newState: ChatState = { flow: "feature" }
        return jsonResponse(
          {
            kind: "upgrade",
            message: `${meta.label} is a Pro feature. You can open it after upgrading. Free features: Dashboard and Transactions.`,
            action: { label: meta.label, href: meta.href, proOnly: true },
            suggestions: ["Upgrade to Pro", "What free features are there?"],
          },
          newState,
        )
      }
      const newState: ChatState = { flow: "feature" }
      return jsonResponse(
        {
          kind: "feature",
          message: `Alright, opening ${meta.label} for you.\n\n${meta.href}`,
          action: { label: meta.label, href: meta.href },
          suggestions: ["Help", "Other features"],
        },
        newState,
      )
    }
  }

  // Fallback.
  const defaultMessage = pro || admin
    ? `I can help you find features in GrandWealth. Try asking about budgets, gold, stocks, savings, reports, dashboard, or transactions. Or type "help" to see all features. You're on ${plan}.`
    : `I can help answer questions about GrandWealth. Try asking about the dashboard, transactions, or Pro features like budgets, gold, stocks, and reports. You're on ${plan}.`
  const newState: ChatState = { flow: "idle" }
  return jsonResponse(
    {
      kind: "text",
      message: defaultMessage,
      suggestions: [
        "What features are available?",
        "Help",
        pro || admin ? "Budget" : "Upgrade",
        "Dashboard",
      ],
    },
    newState,
  )
}

async function startAddTransactionFlow(
  userId: string,
  parsed: ParsedAddTransaction,
): Promise<NextResponse> {
  const userCategories = await loadUserCategories(userId)

  const data: Record<string, unknown> = {}
  if (parsed.type) data.type = parsed.type
  if (parsed.amount != null) data.amount = parsed.amount
  if (parsed.remainder) data.remainder = parsed.remainder

  // The message may already carry the category (and notes) after the amount.
  applyRemainder(data, userCategories)

  // Everything needed came in one message → create it without asking anything.
  if (data.type != null && data.amount != null && data.category != null) {
    return createAndRespond(userId, data)
  }

  const prompt = transactionPrompt(
    {
      type: data.type as "INCOME" | "EXPENSE" | undefined,
      amount: data.amount as number | undefined,
      category: data.category as string | undefined,
    },
    userCategories,
  )

  const state: ChatState = {
    flow: "add-transaction-field",
    command: "add-transaction",
    data,
    field: prompt.field,
    suggestions: prompt.suggestions,
    userCategories,
  }

  return jsonResponse(prompt, state)
}

async function continueAddTransactionFlow(
  userId: string,
  state: ChatState,
  answer: string,
): Promise<NextResponse | null> {
  // If we're resuming the add-transaction flow but don't yet have the
  // category list, load it now so invalid-category replies can be handled.
  if (state.flow === "add-transaction-field" && state.userCategories == null) {
    state.userCategories = await loadUserCategories(userId)
  }

  const data: Record<string, unknown> = state.data ?? {}
  const upper = answer.trim()

  // --- type ---
  if (state.field === "type") {
    let nextType: "INCOME" | "EXPENSE" | undefined
    if (/^(income|earning|receipt|pemasukan|saya\s*masuk)$/i.test(upper)) nextType = "INCOME"
    else if (/^(expense|spending|spend|saya\s*keluar|pengeluaran|cost)$/i.test(upper)) nextType = "EXPENSE"

    if (nextType == null) {
      return jsonResponse(
        {
          kind: "prompt",
          message: "Sorry, I didn't catch that. Is it Income or Expense?",
          field: "type",
          suggestions: ["Income", "Expense"],
        },
        { ...state, flow: "add-transaction-field", field: "type" },
      )
    }

    data.type = nextType
  }

  // A one-shot message may have included "<category> <notes>" that we couldn't
  // resolve until the type was known.
  if (state.field !== "notes") {
    applyRemainder(data, state.userCategories ?? [])
  }

  // --- amount (allow correcting it mid-flow) ---
  if (state.field === "amount") {
    const parsed = parseAddTransaction(answer)
    if (parsed?.amount != null) {
      data.amount = parsed.amount
      if (parsed.type) data.type = parsed.type
    } else {
      const m = answer.match(/[-+]?\d[\d,\.]*/)
      if (!m) {
        return jsonResponse(
          {
            kind: "prompt",
            message: "Please tell me the amount, like 10000 or -5000.",
            field: "amount",
            suggestions: ["10000", "50000", "100000"],
          },
          { ...state, flow: "add-transaction-field", field: "amount" },
        )
      }
      const n = parseAmount(m[0])
      if (n == null) {
        return jsonResponse(
          {
            kind: "prompt",
            message: "I couldn't read that amount. Try something like 10000.",
            field: "amount",
            suggestions: ["10000", "50000", "100000"],
          },
          { ...state, flow: "add-transaction-field", field: "amount" },
        )
      }
      data.amount = n
    }
  }

  // --- category ---
  if (state.field === "category") {
    const resolvedType: "INCOME" | "EXPENSE" =
      data.type === "INCOME" ? "INCOME" : "EXPENSE"
    const options = categoryOptionsForType(state.userCategories, resolvedType)

    const answer = upper
      .replace(/^(category|buat|kategori|gunakan|pakai)\s*/i, "")
      .replace(/^(for|untuk|karena|as|like|itu)$/i, "")
      .trim()

    if (!answer) {
      return jsonResponse(
        {
          kind: "prompt",
          message: "Could you give me a category name, like Food or Salary?",
          field: "category",
          suggestions: categorySuggestions(options),
        },
        { ...state, flow: "add-transaction-field", field: "category" },
      )
    }

    // Only accept a category the user already has for this type, matched case-
    // and format-insensitively. Store the canonical name so the transaction
    // lines up with the rest of the app.
    const normalized = normalizeCategoryName(answer)
    const match = options.find((opt) => normalizeCategoryName(opt) === normalized)
    if (!match) {
      return jsonResponse(
        {
          kind: "prompt",
          message: `I don't have a category called "${answer}" for your ${resolvedType === "INCOME" ? "income" : "expense"} transactions in your account. Try one of these:`,
          field: "category",
          suggestions: categorySuggestions(options),
        },
        { ...state, flow: "add-transaction-field", field: "category" },
      )
    }

    data.category = match
  }

  // --- notes (optional) ---
  if (state.field === "notes") {
    const trimmed = upper.trim()
    // Exact "no"/"skip"-style answers mean "don't add a note"; anything else
    // is treated as the note itself.
    const skipPatterns =
      /^(no|nope|nah|none|skip|n\/?a|nothing(\s+else)?|no\s+thanks?|tidak|gak|ga|udah|sudah|selesai|done|ok|oke|sure|iya|bisa|gitu|y|yes|yah|ya|-)$/i
    if (!skipPatterns.test(trimmed)) {
      const note = trimmed
        .replace(/^(note|notes|catatan|tambahan|add\s+note|add|plus)\s*:?\s*/i, "")
        .trim()
      if (note) data.notes = note.slice(0, 500)
    }
  }

  // Ask for the next unanswered field (type → amount → category → notes).
  // The transaction is only created once notes have been offered and answered.
  const missing = (["type", "amount", "category"] as const).filter(
    (k) => data[k] == null,
  )

  // The original message already supplied the category (and maybe notes), so
  // once the type is known there's nothing left to ask — create it now.
  if (state.field !== "notes" && missing.length === 0 && data.oneShot === true) {
    return createAndRespond(userId, data)
  }

  if (state.field !== "notes" || missing.length > 0) {
    const next = transactionPrompt(
      {
        type: data.type as "INCOME" | "EXPENSE" | undefined,
        amount: data.amount as number | undefined,
        category: data.category as string | undefined,
      },
      state.userCategories,
    )
    return jsonResponse(next, {
      ...state,
      flow: "add-transaction-field",
      data,
      field: next.field,
      suggestions: next.suggestions,
    })
  }

  // Everything is answered → create the transaction.
  return createAndRespond(userId, data)
}

/** Create the assembled transaction and reply with a success + undo affordance. */
async function createAndRespond(
  userId: string,
  data: Record<string, unknown>,
): Promise<NextResponse> {
  const createRes = await createTransactionForUser(userId, {
    type: data.type as "INCOME" | "EXPENSE",
    category: data.category as string,
    amount: data.amount as number,
    notes: (data.notes as string) ?? undefined,
  })

  if ("error" in createRes) {
    return jsonResponse(
      {
        kind: "text",
        message: createRes.error,
        suggestions: ["Try again", "Add another transaction", "Help"],
      },
      { flow: "idle" },
    )
  }

  return jsonResponse(
    {
      kind: "feature",
      message: `Done! I've added your ${createRes.type === "INCOME" ? "income" : "expense"} of ${formatAmount(createRes.amount)} to **${createRes.category}**${createRes.notes ? ` (${createRes.notes})` : ""}${createRes.id ? ` (ID: ${createRes.id})` : ""}.\n\nYou can view it in your Transactions.`,
      action: { label: "Open transactions", href: "/transactions" },
      suggestions: ["Undo", "Dashboard", "Help"],
    },
    // Keep the created id so the user can say "undo" next.
    { flow: "idle", data: { lastTransactionId: createRes.id } },
  )
}

/** Delete a transaction the chatbot created earlier in this conversation. */
async function undoLastTransaction(
  userId: string,
  id: string,
): Promise<NextResponse> {
  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    return jsonResponse(
      {
        kind: "text",
        message:
          "I couldn't find that transaction to undo — it may have already been removed.",
        suggestions: ["Help", "Dashboard"],
      },
      { flow: "idle" },
    )
  }

  await prisma.transaction.delete({ where: { id } })
  return jsonResponse(
    {
      kind: "text",
      message: `Done, I removed the ${existing.type === "INCOME" ? "income" : "expense"} of ${formatAmount(existing.amount)} (${existing.category}).`,
      suggestions: ["add expense 10000", "Help"],
    },
    { flow: "idle" },
  )
}

async function loadUserCategories(userId: string): Promise<UserCategory[]> {
  return prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { name: true, type: true },
  })
}

interface CreateTxResult {
  id: string
  type: "INCOME" | "EXPENSE"
  category: string
  amount: number
  notes?: string
  date: string
}

interface CreateTxError {
  error: string
}

async function createTransactionForUser(
  userId: string,
  data: {
    type: "INCOME" | "EXPENSE"
    category: string
    amount: number
    notes?: string
  },
): Promise<CreateTxResult | CreateTxError> {
  if (!["INCOME", "EXPENSE"].includes(data.type)) {
    return { error: "Type must be INCOME or EXPENSE." }
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    return { error: "Amount must be a positive number." }
  }
  if (!data.category || data.category.length < 1) {
    return { error: "Category is required." }
  }
  if (data.category.length > 100) {
    return { error: "Category must be 100 characters or fewer." }
  }

  const transaction = await prisma.transaction.create({
    data: {
      type: data.type,
      category: data.category,
      amount: data.amount,
      description: data.category,
      notes: data.notes ?? null,
      date: new Date(),
      userId,
    },
  })

  return {
    id: transaction.id,
    type: transaction.type,
    category: transaction.category,
    amount: transaction.amount,
    notes: transaction.notes ?? undefined,
    date: transaction.date.toISOString(),
  }
}
