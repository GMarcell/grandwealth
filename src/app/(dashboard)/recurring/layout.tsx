import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recurring Transactions",
  description:
    "Manage your recurring bills, subscriptions, and automated income. Track monthly recurring cash flow.",
}

export default function RecurringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
