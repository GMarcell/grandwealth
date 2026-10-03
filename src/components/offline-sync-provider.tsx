"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  dequeue,
  getQueue,
  subscribe,
  type QueuedRequest,
} from "@/lib/offline-queue"
import { replayQueued } from "@/lib/api-mutate"
import { useOnlineStatus } from "@/hooks/use-online-status"

interface OfflineSyncContextValue {
  pendingCount: number
  /** Replay all queued writes now. Safe to call concurrently. */
  sync: () => Promise<void>
  isSyncing: boolean
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null)

/** React Query roots to invalidate once queued writes land on the server. */
const INVALIDATE_KEYS = [
  "transactions",
  "dashboard",
  "budgets",
  "rollover-history",
  "savings",
  "gold",
  "stocks",
  "recurring",
  "goals",
  "loans",
  "debts",
  "categories",
  "dividends",
  "analysis",
]

/**
 * Watches the offline queue, replays writes when the connection returns, and
 * exposes the pending count to the UI. Mounted once in the root layout.
 */
export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus()
  const queryClient = useQueryClient()
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncingRef = useRef(false)

  // Keep the pending count in sync with storage (including cross-tab changes
  // via the storage event, which the queue library does not observe directly).
  useEffect(() => {
    setPendingCount(getQueue().length)
    const unsubscribe = subscribe((queue) => setPendingCount(queue.length))
    const onStorage = () => setPendingCount(getQueue().length)
    window.addEventListener("storage", onStorage)
    return () => {
      unsubscribe()
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const sync = useCallback(async () => {
    if (syncingRef.current) return
    const queue = getQueue()
    if (queue.length === 0) return

    syncingRef.current = true
    setIsSyncing(true)

    let succeeded = 0
    let dropped = 0

    try {
      // Replay oldest-first to preserve the order the user made the changes.
      for (const item of queue) {
        const outcome = await replayQueued(item)
        if (outcome === "ok") {
          dequeue(item.id)
          succeeded++
        } else if (outcome === "failed") {
          // Permanently rejected (e.g. the record no longer exists) — drop it
          // so it cannot block the rest of the queue.
          dequeue(item.id)
          dropped++
        } else {
          // Still offline or a transient server error: stop and keep the
          // remaining items for the next attempt.
          break
        }
      }
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
    }

    if (succeeded > 0) {
      for (const key of INVALIDATE_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      toast.success(
        succeeded === 1
          ? "Synced 1 offline change"
          : `Synced ${succeeded} offline changes`,
      )
    }

    if (dropped > 0) {
      toast.error(
        dropped === 1
          ? "1 offline change could not be synced and was discarded"
          : `${dropped} offline changes could not be synced and were discarded`,
      )
    }
  }, [queryClient])

  // Replay whenever the connection returns or on mount if items are pending
  // (e.g. the user closed the tab while offline and came back online later).
  useEffect(() => {
    if (!isOnline) return
    if (getQueue().length === 0) return
    void sync()
  }, [isOnline, sync])

  // Also attempt a sync on mount, in case the app was reloaded while online.
  useEffect(() => {
    void sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <OfflineSyncContext.Provider value={{ pendingCount, sync, isSyncing }}>
      {children}
    </OfflineSyncContext.Provider>
  )
}

/** Access the offline sync state. Returns null when used outside the provider. */
export function useOfflineSync() {
  return useContext(OfflineSyncContext)
}

export type { QueuedRequest }
