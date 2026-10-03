// Minimal service worker for GrandWealth.
//
// Scope of this worker is intentionally small: it exists so the app can show a
// proper offline fallback instead of the browser's "no internet" error when a
// navigation fails. It does NOT cache API responses or user data — financial
// data must always come from the network so it is never stale.
//
// Strategy:
//   - Navigation requests: network-first, falling back to the precached
//     /offline page when the network is unavailable.
//   - Same-origin static assets (/_next/static, icons, fonts): stale-while-
//     revalidate so repeat visits are fast and still work offline.
//   - Everything else (API calls, etc.): passed straight through to the network.

const CACHE_NAME = "grandwealth-v1"
const OFFLINE_URL = "/offline"

// Precache the offline shell during install so it is available even if the
// very first navigation happens while offline.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  )
  // Activate the new worker immediately instead of waiting for old tabs to close.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions.
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  // Only handle GETs; let mutations (POST/PATCH/DELETE) hit the network.
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations: network-first, offline page as the fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cache = await caches.open(CACHE_NAME)
          const offline = await cache.match(OFFLINE_URL)
          return (
            offline ??
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          )
        }
      })()
    )
    return
  }

  // Static assets: stale-while-revalidate.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico|woff2?|ttf|css|js)$/.test(
      url.pathname
    )

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached ?? network
      })()
    )
  }
})
