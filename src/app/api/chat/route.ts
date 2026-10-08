import { NextResponse } from "next/server"
import { requireUser } from "@/lib/api-access"
import { getAccessRecord } from "@/lib/account-access"
import { isAdminUser, isProUser, planLabel } from "@/lib/subscription"
import { prisma } from "@/lib/prisma"

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
  userCategories?: string[]
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
 *   add transaction -10000     (negative -> expense)
 */
// Track the command word so we can infer type even when amount comes first.
export interface ParsedAddTransaction {
  type?: "INCOME" | "EXPENSE"
  amount?: number
}

function parseAddTransaction(text: string): ParsedAddTransaction | null {
  const normalized = text
    .toLowerCase()
    .replace(/[_\u2010-\u2015]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const addMatch = normalized.match(
    /^(?:add|new|create|input)\s+(transaction|expense|income|receipt|spending|spend|pemasukan|pengeluaran)\s+(.+)$/i,
  )
  if (!addMatch) return null

  const [, commandWord, rest] = addMatch
  const _commandType = typeWordMatch(commandWord)
  const trimmedRest = rest.trim()

  // Explicit type after command word: "add expense 10000" -> commandWord="expense", rest="10000"
  // Here the type is already known from the command word.
  const explicitTypeFirst = trimmedRest.match(/^(expense|income|receipt|spending|spend)\s+(.+)$/i)
  if (explicitTypeFirst) {
    const [, typeWord, amountRaw] = explicitTypeFirst
    const amount = parseAmount(amountRaw)
    if (amount == null) return null
    return { type: typeWordMatch(typeWord), amount }
  }

  const amountThenType = trimmedRest.match(
    /^([-+]?\d[\d,\.]*)\s+(expense|income|receipt|spending|send|receive|pemasukan|pengeluaran)$/i,
  )
  if (amountThenType) {
    const amount = parseAmount(amountThenType[1])
    if (amount == null) return null
    return { type: typeWordMatch(amountThenType[2]), amount }
  }

  // parseAmount returns the absolute value; track sign separately so
  // "add transaction -10000" still infers expense.
  const rawNum = Number(trimmedRest.replace(/[,\s]/g, ""))
  const isNegative = Number.isFinite(rawNum) && rawNum < 0
  const bareAmount = parseAmount(trimmedRest)
  if (bareAmount != null) {
    if (isNegative) return { type: "EXPENSE", amount: bareAmount }
    // Bare amount after an explicit type word infers that type.
    // "add transaction 10000" must still ask for type.
    if (commandWord.toLowerCase() === "expense") return { type: "EXPENSE", amount: bareAmount }
    if (commandWord.toLowerCase() === "income") return { type: "INCOME", amount: bareAmount }
    if (commandWord.toLowerCase() === "receipt" || commandWord.toLowerCase() === "spend") {
      return { type: typeWordMatch(commandWord), amount: bareAmount }
    }
    return { amount: bareAmount }
  }

  return null
}

function typeWordMatch(word: string): "INCOME" | "EXPENSE" {
  const w = word.toLowerCase()
  if (w === "income" || w === "receipt" || w === "spend" || w === "receive" || w === "pemasukan") return "INCOME"
  return "EXPENSE"
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "")
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n === 0) return null
  return Math.abs(n)
}

function transactionPrompt(
  fields: {
    type?: "INCOME" | "EXPENSE"
    amount?: number
    category?: string
    notes?: string
  },
): ChatResponse {
  if (fields.amount == null) {
    return {
      kind: "prompt",
      message: "Got it. How much is the transaction? (For example: 10000 or -5000)",
      field: "amount",
      suggestions: ["10000", "50000", "100000"],
    }
  }

  // Default to expense when the user hasn't specified a type.
  const resolvedType: "INCOME" | "EXPENSE" = fields.type ?? "EXPENSE"

  if (fields.category == null) {
    return {
      kind: "prompt",
      message: `Okay, ${resolvedType === "INCOME" ? "income" : "expense"} of ${formatAmount(fields.amount!)}. Which category should I use?`,
      field: "category",
      suggestions: ["Salary", "Food", "Transport", "Other"],
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
  const prompt = transactionPrompt({
    type: parsed.type,
    amount: parsed.amount,
  })

  const resolvedType: "INCOME" | "EXPENSE" | undefined = parsed.type ?? "EXPENSE"

  const userCategories = await loadUserCategories(userId)

  const state: ChatState = {
    flow: "add-transaction-field",
    command: "add-transaction",
    data: {
    ...(resolvedType ? { type: resolvedType } : {}),
    ...(parsed.amount != null ? { amount: parsed.amount as number } : {}),
    },
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
    const category = upper
      .replace(/^(category|buat|kategori|gunakan|pakai)\s*/i, "")
      .replace(/^(for|untuk|karena|as|like|itu)$/i, "")
      .trim()
    if (!category || category.length < 1) {
      return jsonResponse(
        {
          kind: "prompt",
          message: "Could you give me a category name, like Food or Salary?",
          field: "category",
          suggestions: ["Salary", "Food", "Transport", "Other"],
        },
        { ...state, flow: "add-transaction-field", field: "category" },
      )
    }
    data.category = category.slice(0, 100)

    // If the category doesn't exist for this user, don't create the transaction
    // yet — ask them to confirm or choose a different one.
    if (state.userCategories == null) {
      return jsonResponse(
        {
          kind: "prompt",
          message: `I'm not sure I recognize the category "${data.category}". Is that right, or would you prefer a different one?`,
          field: "category",
          suggestions: ["Use a different category", "I meant another category"],
        },
        { ...state, flow: "add-transaction-field", field: "category", userCategories: [] },
      )
    }

    const normalized = category.trim().toLowerCase()
    const match = state.userCategories.find(
      (c) => c.trim().toLowerCase() === normalized,
    )
    if (!match) {
      return jsonResponse(
        {
          kind: "prompt",
          message: `I don't have a category called "${data.category}" in your account. Try one of these, or say "Other" if none fit:`,
          field: "category",
          suggestions: [...state.userCategories.slice(0, 6), "Other"],
        },
        { ...state, flow: "add-transaction-field", field: "category" },
      )
    }
  }

  // --- notes (optional) ---
  if (state.field === "notes") {
    const yesPatterns = /^(yes|yah|y|iya|bisa|gitu|selesai|done|no problem|ok|oke|sure|ya)/i
    const addNotePatterns = /^(add|yes,? add|tambah|plus|bisa.*tambah|note.*:\s*\w)/i

    if (yesPatterns.test(upper) && !addNotePatterns.test(upper)) {
      // Skip notes.
    } else if (addNotePatterns.test(upper) || upper.length > 1) {
      const note = upper.replace(/^(note|notes|catatan|tambahan|add|plus)\s*:?\s*/i, "").trim()
      if (note && note.length > 1) {
        data.notes = note.slice(0, 500)
      }
    }
  }

  // Validate required fields.
  const required: Array<keyof typeof data> = ["type", "amount", "category"]
  const missing = required.filter((k) => data[k] == null)
  if (missing.length > 0) {
    const field = missing[0]
    return jsonResponse(
      {
        kind: "prompt",
        message: `Missing: ${field}. ${field === "type" ? "Is it income or expense?" : field === "amount" ? "What's the amount?" : "Which category?"}`,
        field,
        suggestions:
          field === "type" ? ["Income", "Expense"] :
          field === "amount" ? ["10000", "50000", "100000"] :
          ["Salary", "Food", "Transport", "Other"],
      },
      { ...state, flow: "add-transaction-field", field },
    )
  }

  // If we haven't asked about notes yet, do that now.
  if (state.field !== "notes") {
    const next = transactionPrompt({
      type: data.type as "INCOME" | "EXPENSE",
      amount: data.amount as number,
      category: data.category as string,
    })
    return jsonResponse(next, {
      ...state,
      flow: "add-transaction-field",
      data,
      field: next.field,
      suggestions: next.suggestions,
    })
  }

  // Create the transaction.
  const createRes = await createTransactionForUser(userId, {
    type: data.type as "INCOME" | "EXPENSE",
    category: data.category as string,
    amount: data.amount as number,
    notes: (data.notes as string) ?? undefined,
  })

  const doneState: ChatState = { flow: "idle" }

  if ("error" in createRes) {
    return jsonResponse(
      {
        kind: "text",
        message: createRes.error,
        suggestions: ["Try again", "Add another transaction", "Help"],
      },
      doneState,
    )
  }

  return jsonResponse(
    {
      kind: "feature",
      message: `Done! I've added your ${createRes.type === "INCOME" ? "income" : "expense"} of ${formatAmount(createRes.amount)} to **${createRes.category}**${createRes.notes ? ` (${createRes.notes})` : ""}${createRes.id ? ` (ID: ${createRes.id})` : ""}.\n\nYou can view it in your Transactions.`,
      action: { label: "Open transactions", href: "/transactions" },
      suggestions: ["Add another transaction", "Dashboard", "Help"],
    },
    doneState,
  )
}

async function loadUserCategories(userId: string): Promise<string[]> {
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { name: true },
  })
  return categories.map((c) => c.name)
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
