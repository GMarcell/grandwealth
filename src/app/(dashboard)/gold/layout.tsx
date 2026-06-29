import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gold",
}

export default function GoldLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
