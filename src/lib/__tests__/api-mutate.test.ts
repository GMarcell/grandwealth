import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { apiMutate, isQueuedResult, replayQueued } from "../api-mutate"
import { getQueue, clearQueue } from "../offline-queue"

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  })
}

describe("apiMutate", () => {
  beforeEach(() => {
    clearQueue()
    setOnline(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearQueue()
  })

  it("sends the request with an idempotency key when online", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "1" }), { status: 201 }),
      )

    const result = await apiMutate("/api/x", { method: "POST", body: { a: 1 } })

    expect(result).toEqual({ id: "1" })
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers["Idempotency-Key"]).toBeTruthy()
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("queues the write without a round-trip when already offline", async () => {
    setOnline(false)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const result = await apiMutate("/api/x", { method: "POST", body: { a: 1 } })

    expect(isQueuedResult(result)).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getQueue()).toHaveLength(1)
    expect(getQueue()[0].url).toBe("/api/x")
  })

  it("queues the write when fetch throws (network failure)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))

    const result = await apiMutate("/api/x", { method: "PATCH", body: { a: 2 } })

    expect(isQueuedResult(result)).toBe(true)
    expect(getQueue()).toHaveLength(1)
  })

  it("throws on a non-OK server response and does not queue", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Bad input" }), { status: 400 }),
    )

    await expect(
      apiMutate("/api/x", { method: "POST", body: {} }),
    ).rejects.toThrow("Bad input")
    expect(getQueue()).toHaveLength(0)
  })

  it("handles an empty response body (e.g. DELETE)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }))
    const result = await apiMutate("/api/x", { method: "DELETE" })
    expect(result).toEqual({ success: true })
  })
})

describe("replayQueued", () => {
  afterEach(() => vi.restoreAllMocks())

  const item = { id: "k1", method: "POST", url: "/api/x", body: { a: 1 } }

  it("returns ok on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
    expect(await replayQueued(item)).toBe("ok")
  })

  it("returns failed on a 4xx (permanently rejected)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }))
    expect(await replayQueued(item)).toBe("failed")
  })

  it("returns retry on a 5xx (transient)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }))
    expect(await replayQueued(item)).toBe("retry")
  })

  it("returns retry when the network still fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))
    expect(await replayQueued(item)).toBe("retry")
  })

  it("sends the original idempotency key", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    await replayQueued(item)
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers["Idempotency-Key"]).toBe("k1")
  })
})
