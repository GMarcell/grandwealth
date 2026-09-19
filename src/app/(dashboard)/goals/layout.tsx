import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Savings Goals",
  description:
    "Set savings goals like an emergency fund, vacation, or down payment and track your progress toward them.",
}

export default async function GoalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
