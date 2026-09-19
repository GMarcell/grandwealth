import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Debts & Loans",
  description:
    "Track loans and installments so your net wealth always reflects your true liabilities.",
}

export default async function DebtsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
