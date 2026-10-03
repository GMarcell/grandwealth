import Link from "next/link"
import type { Metadata } from "next"
import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Offline",
  // Never let a crawler index the offline shell.
  robots: { index: false, follow: false },
}

/**
 * Offline fallback. The service worker (public/sw.js) serves this page when a
 * navigation request fails because the device has no network connection.
 * It must stay static so it can be precached.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="h-7 w-7" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-foreground">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          GrandWealth needs a network connection to load your latest data. Check
          your connection and try again.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Try again</Link>
      </Button>
    </div>
  )
}
