import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your GrandWealth account to access your financial dashboard, budgets, and investment portfolio.",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
