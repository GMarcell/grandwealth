import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Budgets",
  description:
    "Set monthly spending limits for expense categories. Track budget health with rollover support and visual progress bars.",
}

export default function BudgetsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
