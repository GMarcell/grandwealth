import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Configure your GrandWealth account settings, manage categories, and customize your budget preferences.",
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
