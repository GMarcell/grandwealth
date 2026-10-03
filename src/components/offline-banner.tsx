"use client"

import { CloudOff, WifiOff } from "lucide-react"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useOfflineSync } from "@/components/offline-sync-provider"

/**
 * Shows a fixed banner while the device has no network connection and hides it
 * automatically when the connection returns. When there are writes waiting to
 * sync, the banner also shows how many are pending.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const sync = useOfflineSync()
  const pendingCount = sync?.pendingCount ?? 0

  // While online, only surface a banner when writes are still waiting to sync.
  if (isOnline && pendingCount === 0) return null

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t border-amber-500/20 bg-amber-500/95 px-4 py-2 text-sm font-medium text-amber-950 shadow-lg"
      >
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          You&apos;re offline. Changes are saved on this device and will sync
          when you reconnect.
        </span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-950/15 px-2 py-0.5 text-xs font-semibold tabular-nums">
            {pendingCount} pending
          </span>
        )}
      </div>
    )
  }

  // Online but items are still queued (e.g. a sync is in flight or was
  // interrupted). Inform the user rather than leaving them wondering.
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t border-sky-500/20 bg-sky-500/95 px-4 py-2 text-sm font-medium text-sky-950 shadow-lg"
    >
      <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Syncing {pendingCount === 1 ? "1 change" : `${pendingCount} changes`}
        &hellip;
      </span>
    </div>
  )
}
