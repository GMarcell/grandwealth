"use client"

import { useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

function getSnapshot() {
  return navigator.onLine
}

// Assume online during SSR so the banner never flashes for connected users on
// the first paint; the client corrects it immediately after hydration.
function getServerSnapshot() {
  return true
}

/**
 * Tracks whether the browser currently has a network connection.
 * Returns `true` while online and `false` while offline.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
