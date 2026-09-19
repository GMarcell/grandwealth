import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Budgets",
  description:
    "Set monthly spending limits for expense categories. Track budget health with rollover support and visual progress bars.",
}

export default async function BudgetsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
