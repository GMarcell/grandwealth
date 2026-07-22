import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Transactions",
  description:
    "Track and manage your income and expense transactions. Add, edit, search, and export your financial records.",
}

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
