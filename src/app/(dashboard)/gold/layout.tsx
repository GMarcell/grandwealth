import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gold",
  description:
    "Track your gold investment portfolio. Monitor gold prices, total holdings, and profit or loss in real time.",
}

export default function GoldLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
