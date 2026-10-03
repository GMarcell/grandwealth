/**
 * Offline write queue.
 *
 * When a data mutation fails because the device is offline, the request is
 * persisted to localStorage and replayed once the connection returns (or on
 * the next visit). Each queued item carries a unique idempotency key so a
 * replay of a request that actually reached the server is skipped instead of
 * applied twice.
 *
 * Reads are never queued — only mutations that the user explicitly initiated.
 */

const STORAGE_KEY = "grandwealth:offline-queue:v1"

export interface QueuedRequest {
  /** Unique idempotency key sent as the `Idempotency-Key` header on replay. */
  id: string
  method: string
  url: string
  /** JSON-serialisable request body, if any. */
  body: unknown
  /** Epoch ms the request was queued — used to preserve ordering. */
  queuedAt: number
}

type Listener = (queue: QueuedRequest[]) => void

const listeners = new Set<Listener>()

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

function read(): QueuedRequest[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is QueuedRequest =>
        item &&
        typeof item.id === "string" &&
        typeof item.url === "string" &&
        typeof item.method === "string",
    )
  } catch {
    // Corrupt storage should never break the app.
    return []
  }
}

function write(queue: QueuedRequest[]) {
  if (!isBrowser()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Quota errors are non-fatal; the in-memory replay still runs.
  }
  for (const listener of listeners) listener(queue)
}

/** Current queued requests, oldest first. */
export function getQueue(): QueuedRequest[] {
  return read()
}

/** Number of writes waiting to sync. */
export function getPendingCount(): number {
  return read().length
}

/** Append a write to the queue. */
export function enqueue(item: Omit<QueuedRequest, "queuedAt">): QueuedRequest[] {
  const queue = read()
  queue.push({ ...item, queuedAt: Date.now() })
  write(queue)
  return queue
}

/** Remove a queued write by idempotency key (after a successful replay). */
export function dequeue(id: string): QueuedRequest[] {
  const queue = read().filter((item) => item.id !== id)
  write(queue)
  return queue
}

/** Clear the whole queue (e.g. after sign-out). */
export function clearQueue(): void {
  write([])
}

/** Subscribe to queue changes. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Generate a unique idempotency key. */
export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
