import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  getQueue,
  getPendingCount,
  enqueue,
  dequeue,
  clearQueue,
  subscribe,
  createIdempotencyKey,
} from "../offline-queue"

describe("offline-queue", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("starts empty", () => {
    expect(getQueue()).toEqual([])
    expect(getPendingCount()).toBe(0)
  })

  it("enqueues a write with a timestamp", () => {
    enqueue({ id: "k1", method: "POST", url: "/api/x", body: { a: 1 } })
    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe("k1")
    expect(queue[0].method).toBe("POST")
    expect(queue[0].body).toEqual({ a: 1 })
    expect(typeof queue[0].queuedAt).toBe("number")
  })

  it("preserves insertion order", () => {
    enqueue({ id: "a", method: "POST", url: "/1", body: null })
    enqueue({ id: "b", method: "POST", url: "/2", body: null })
    expect(getQueue().map((q) => q.id)).toEqual(["a", "b"])
  })

  it("dequeues a single item by id", () => {
    enqueue({ id: "a", method: "POST", url: "/1", body: null })
    enqueue({ id: "b", method: "POST", url: "/2", body: null })
    dequeue("a")
    expect(getQueue().map((q) => q.id)).toEqual(["b"])
  })

  it("clears the queue", () => {
    enqueue({ id: "a", method: "POST", url: "/1", body: null })
    clearQueue()
    expect(getPendingCount()).toBe(0)
  })

  it("survives corrupt storage", () => {
    localStorage.setItem("grandwealth:offline-queue:v1", "not json")
    expect(getQueue()).toEqual([])
  })

  it("drops malformed entries", () => {
    localStorage.setItem(
      "grandwealth:offline-queue:v1",
      JSON.stringify([{ id: "ok", method: "POST", url: "/1", body: null }, { nope: true }]),
    )
    expect(getQueue().map((q) => q.id)).toEqual(["ok"])
  })

  it("notifies subscribers on change", () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    enqueue({ id: "a", method: "POST", url: "/1", body: null })
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    unsubscribe()
    enqueue({ id: "a", method: "POST", url: "/1", body: null })
    expect(listener).not.toHaveBeenCalled()
  })

  it("generates unique idempotency keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => createIdempotencyKey()))
    expect(keys.size).toBe(50)
  })
})
