import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Admin",
  description:
    "Manage GrandWealth users: browse accounts, assign plans, and control access.",
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // DB-backed guard — role changes take effect immediately. Non-admins are
  // redirected to /dashboard.
  await requireAdmin()
  return children
}
