import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reports",
  description:
    "Generate financial reports and insights. Analyze spending patterns, income trends, and budget performance over time.",
}

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
