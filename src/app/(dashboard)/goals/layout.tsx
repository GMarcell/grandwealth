import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Savings Goals",
  description:
    "Set savings goals like an emergency fund, vacation, or down payment and track your progress toward them.",
}

export default function GoalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
