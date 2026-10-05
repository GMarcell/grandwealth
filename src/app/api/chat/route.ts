import { NextResponse } from "next/server"
import { requireUser } from "@/lib/api-access"
import { getAccessRecord } from "@/lib/account-access"
import { isAdminUser, isProUser } from "@/lib/subscription"

const FREE_FEATURES = ["dashboard", "transactions"]
const PRO_FEATURES = ["budgets", "gold", "stocks", "savings", "goals", "debts", "recurring", "reports", "AI analysis"]

export async function POST(request: Request) {
  const userId = await requireUser()
  if (userId instanceof NextResponse) return userId

  const body = await request.json().catch(() => null)
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages are required" }, { status: 400 })
  }
  const user = await getAccessRecord(userId)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const pro = isProUser(user)
  const isAdmin = isAdminUser(user)
  const availableFeatures = isAdmin || pro ? [...FREE_FEATURES, ...PRO_FEATURES] : FREE_FEATURES

  const text = String(messages.at(-1)?.content ?? "").toLowerCase()
  const requestedProFeature = Object.entries({
    budget: "/budgets",
    gold: "/gold",
    stock: "/stocks",
    savings: "/savings",
    recurring: "/recurring",
    report: "/reports",
    analysis: "/analysis",
    goal: "/goals",
    debt: "/debts",
  }).find(([keyword]) => text.includes(keyword))

  let response = "I can help you navigate GrandWealth. Try asking about transactions, budgets, savings, gold, stocks, or reports."
  if (text.includes("transaction") || text.includes("income") || text.includes("expense")) {
    response = "You can add or manage transactions from the Transactions page."
  } else if (requestedProFeature && !pro) {
    response = `The ${requestedProFeature[0]} feature is available with Pro. You can learn more on the upgrade page: /upgrade`
  } else if (requestedProFeature) {
    response = `You can open the ${requestedProFeature[0]} feature here: ${requestedProFeature[1]}`
  } else if (text.includes("access") || text.includes("plan") || text.includes("feature")) {
    response = `Your available features are: ${availableFeatures.join(", ")}.`
  } else if (text.includes("hello") || text.includes("hi") || text.includes("help")) {
    response = pro
      ? "You have Pro access. I can help you find budgets, gold, stocks, savings, recurring transactions, reports, and more."
      : "You can use the dashboard and transactions. Pro unlocks budgets, gold, stocks, savings, recurring transactions, reports, and more."
  }

  return NextResponse.json({ message: response, availableFeatures })
}
