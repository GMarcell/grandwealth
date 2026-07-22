import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Analysis",
  description:
    "Get AI-powered financial analysis and insights into your spending habits, savings progress, and investment performance.",
}

export default function AnalysisLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
