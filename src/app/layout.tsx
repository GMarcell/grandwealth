import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Providers from "@/lib/providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "optional",
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://grandwealth.vercel.app"
        : "http://localhost:3000"),
  ),
  title: {
    template: "%s | GrandWealth",
    default: "GrandWealth — Wealth Management",
  },
  description:
    "Track your expenses, income, gold deposits, and stock portfolio all in one place with GrandWealth — your personal wealth management dashboard.",
  applicationName: "GrandWealth",
  authors: [{ name: "GrandWealth" }],
  creator: "GrandWealth",
  publisher: "GrandWealth",
  keywords: [
    "wealth management",
    "personal finance",
    "budget tracker",
    "expense tracker",
    "income tracking",
    "investment portfolio",
    "stock portfolio",
    "gold investment",
    "savings goals",
    "financial dashboard",
    "money management",
    "budget planner",
    "finance app",
  ],
  referrer: "strict-origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  category: "finance",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "GrandWealth",
    title: "GrandWealth — Wealth Management",
    description:
      "Track your expenses, income, gold deposits, and stock portfolio all in one place with GrandWealth.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "GrandWealth — Wealth Management",
    description:
      "Track your expenses, income, gold deposits, and stock portfolio all in one place with GrandWealth.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GrandWealth",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f4" },
    { media: "(prefers-color-scheme: dark)", color: "#26231b" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
