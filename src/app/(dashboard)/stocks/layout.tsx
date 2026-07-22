import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Stocks",
  description:
    "Track your stock portfolio with real-time prices. Monitor gains, losses, and dividend income from your investments.",
}

export default function StocksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
