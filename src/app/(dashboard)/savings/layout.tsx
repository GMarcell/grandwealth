import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Savings",
  description:
    "Track your savings goals and bank deposits. Monitor progress toward your financial targets.",
}

export default async function SavingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
