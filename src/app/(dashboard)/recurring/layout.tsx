import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recurring",
}

export default function RecurringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
