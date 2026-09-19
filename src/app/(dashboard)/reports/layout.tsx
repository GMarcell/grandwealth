import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Reports",
  description:
    "Generate financial reports and insights. Analyze spending patterns, income trends, and budget performance over time.",
}

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
