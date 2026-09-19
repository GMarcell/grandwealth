import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Stocks",
  description:
    "Track your stock portfolio with real-time prices. Monitor gains, losses, and dividend income from your investments.",
}

export default async function StocksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
