import type { Metadata } from "next"
import { requireAuth } from "@/lib/auth-guard"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export const metadata: Metadata = {
  title: "GrandWealth",
  description:
    "Track your expenses, income, gold deposits, stock portfolio, and monthly budgets with GrandWealth.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Defense-in-depth: ensure the user is authenticated even if middleware
  // is bypassed (e.g. a future route restructure changes the matcher pattern).
  // Middleware handles this first with proper callbackUrl redirect, but this
  // guarantees protection at the layout level for ALL dashboard pages:
  // /dashboard, /transactions, /budgets, /gold, /stocks, /recurring,
  // /reports, /settings, /savings, /analysis.
  await requireAuth()

  return <DashboardLayout>{children}</DashboardLayout>
}
