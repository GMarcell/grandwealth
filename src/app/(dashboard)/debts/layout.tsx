import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Debts & Loans",
  description:
    "Track loans and installments so your net wealth always reflects your true liabilities.",
}

export default function DebtsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
