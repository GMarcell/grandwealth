import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Analysis",
  description:
    "Get AI-powered financial analysis and insights into your spending habits, savings progress, and investment performance.",
}

export default async function AnalysisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
