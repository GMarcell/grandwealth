import type { Metadata } from "next"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export const metadata: Metadata = {
  title: {
    template: "%s | GrandWealth",
    default: "GrandWealth — Wealth Management",
  },
  description:
    "Track your expenses, income, gold deposits, and stock portfolio all in one place.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
