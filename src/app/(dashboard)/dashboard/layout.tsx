import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "View your financial overview, budget health, recent transactions, and net worth at a glance.",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
