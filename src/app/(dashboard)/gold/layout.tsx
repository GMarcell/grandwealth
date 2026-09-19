import type { Metadata } from "next"
import { requirePro } from "@/lib/auth-guard"

export const metadata: Metadata = {
  title: "Gold",
  description:
    "Track your gold investment portfolio. Monitor gold prices, total holdings, and profit or loss in real time.",
}

export default async function GoldLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePro()
  return children
}
