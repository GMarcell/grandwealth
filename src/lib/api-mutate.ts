import { createIdempotencyKey, enqueue } from "@/lib/offline-queue"

export const IDEMPOTENCY_HEADER = "Idempotency-Key"

/** Result returned when a write was queued instead of sent. */
export interface QueuedResult {
  queued: true
}

export function isQueuedResult(value: unknown): value is QueuedResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as QueuedResult).queued === true
  )
}

export interface ApiMutateInit {
  method: "POST" | "PATCH" | "PUT" | "DELETE"
  /** JSON-serialisable body. Omit for bodyless writes (e.g. DELETE). */
  body?: unknown
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

/**
 * Perform a mutating API request.
 *
 * Behaviour:
 *   - Attaches a unique `Idempotency-Key` header so a replayed request is
 *     de-duplicated server-side.
 *   - On a successful response, returns the parsed JSON body.
 *   - On a non-OK response (a real server-side error), throws with the server
 *     message — these are never queued, since retrying would not help.
 *   - When the request fails at the network level (offline), persists it to the
 *     offline queue and resolves with `{ queued: true }`. The sync provider
 *     replays it on reconnect.
 *
 * Callers treat a resolved promise as success; use `isQueuedResult` to branch
 * when the distinction matters.
 */
export async function apiMutate<T = unknown>(
  url: string,
  init: ApiMutateInit,
): Promise<T | QueuedResult> {
  const idempotencyKey = createIdempotencyKey()
  const headers: Record<string, string> = { [IDEMPOTENCY_HEADER]: idempotencyKey }
  const hasBody = init.body !== undefined
  if (hasBody) headers["Content-Type"] = "application/json"

  // Skip the round-trip entirely when the browser already knows it is offline.
  if (isOffline()) {
    enqueue({
      id: idempotencyKey,
      method: init.method,
      url,
      body: init.body ?? null,
    })
    return { queued: true }
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: init.method,
      headers,
      body: hasBody ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    // Network-level failure (offline, DNS, dropped connection). The request
    // may or may not have reached the server, so replay is de-duplicated by
    // the idempotency key.
    enqueue({
      id: idempotencyKey,
      method: init.method,
      url,
      body: init.body ?? null,
    })
    return { queued: true }
  }

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: "Request failed" }))
    throw new Error(err.error || "Request failed")
  }

  // Some endpoints (e.g. DELETE) return an empty body.
  const text = await res.text()
  return (text ? JSON.parse(text) : { success: true }) as T
}

/**
 * Replay a queued write. Unlike `apiMutate` this never re-queues; it reports
 * the outcome so the caller can drop, keep, or surface the item.
 */
export async function replayQueued(item: {
  id: string
  method: string
  url: string
  body: unknown
}): Promise<"ok" | "retry" | "failed"> {
  const headers: Record<string, string> = { [IDEMPOTENCY_HEADER]: item.id }
  const hasBody = item.body !== null && item.body !== undefined
  if (hasBody) headers["Content-Type"] = "application/json"

  try {
    const res = await fetch(item.url, {
      method: item.method,
      headers,
      body: hasBody ? JSON.stringify(item.body) : undefined,
    })

    if (res.ok) return "ok"
    // A 4xx means the queued write is no longer valid (e.g. the record was
    // deleted meanwhile). Retrying forever would never succeed — drop it.
    if (res.status >= 400 && res.status < 500) return "failed"
    // 5xx is transient; keep the item and retry later.
    return "retry"
  } catch {
    return "retry"
  }
}
