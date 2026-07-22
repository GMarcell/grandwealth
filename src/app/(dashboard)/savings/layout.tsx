import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Savings",
  description:
    "Track your savings goals and bank deposits. Monitor progress toward your financial targets.",
}

export default function SavingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
