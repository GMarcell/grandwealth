"use client"

import { useEffect } from "react"

/**
 * Registers the GrandWealth service worker (public/sw.js) so the app can serve
 * an offline fallback page when a navigation fails. Registration is skipped
 * outside production because the worker's caching would otherwise interfere
 * with Next's dev hot-reload.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed:", error)
      })
    }

    if (document.readyState === "complete") register()
    else window.addEventListener("load", register)

    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
