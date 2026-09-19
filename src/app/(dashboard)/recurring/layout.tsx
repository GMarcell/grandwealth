import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Recurring Transactions",
  description:
    "Manage your recurring bills, subscriptions, and automated income. Track monthly recurring cash flow.",
}

export default async function RecurringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
