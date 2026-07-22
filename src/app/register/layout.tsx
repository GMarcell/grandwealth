import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Sign up for GrandWealth and start tracking your expenses, income, investments, and budgets in one place.",
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
