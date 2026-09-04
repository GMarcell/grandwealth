import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    goldDeposit: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}))

// Import after mocks
const { PATCH } = await import("../route")

// ─── Helpers ─────────────────────────────────

interface DepositFixture {
  id: string
  type: "BUY" | "SELL"
  weightGram: number
  pricePerGram: number
  totalAmount: number
  date: Date
  notes: string | null
}

const OTHER_BUY: DepositFixture = {
  id: "buy-10",
  type: "BUY",
  weightGram: 10,
  pricePerGram: 1_000_000,
  totalAmount: 10_000_000,
  date: new Date(),
  notes: null,
}

const SELL_4: DepositFixture = {
  id: "sell-4",
  type: "SELL",
  weightGram: 4,
  pricePerGram: 1_000_000,
  totalAmount: 4_000_000,
  date: new Date(),
  notes: null,
}

function makeRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/gold/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function setupMocks(existing: DepositFixture, others: DepositFixture[]) {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockFindUnique.mockResolvedValue({ ...existing, userId: "user-1" })
  mockFindMany.mockResolvedValue(others)
  mockUpdate.mockImplementation(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
      ...existing,
      ...args.data,
    }),
  )
}

// ─── Tests ───────────────────────────────────

describe("PATCH /api/gold/[id] — auth & ownership", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await PATCH(makeRequest("sell-4", { weightGram: 5 }), {
      params: Promise.resolve({ id: "sell-4" }),
    })
    expect(res.status).toBe(401)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns 404 when the record is not found or not owned", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUnique.mockResolvedValue(null)

    const res = await PATCH(makeRequest("sell-4", { weightGram: 5 }), {
      params: Promise.resolve({ id: "sell-4" }),
    })
    expect(res.status).toBe(404)
  })
})

describe("PATCH /api/gold/[id] — oversell protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  })

  it("allows editing notes without checking holdings", async () => {
    setupMocks(SELL_4, [OTHER_BUY])
    mockFindMany.mockClear() // should not be called for notes-only edits

    const res = await PATCH(makeRequest("sell-4", { notes: "updated" }), {
      params: Promise.resolve({ id: "sell-4" }),
    })

    expect(res.status).toBe(200)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("allows shrinking a SELL weight (improves the position)", async () => {
    setupMocks(SELL_4, [OTHER_BUY])

    const res = await PATCH(makeRequest("sell-4", { weightGram: 2 }), {
      params: Promise.resolve({ id: "sell-4" }),
    })

    expect(res.status).toBe(200)
  })

  it("allows turning a SELL into a BUY", async () => {
    setupMocks(SELL_4, [OTHER_BUY])

    const res = await PATCH(makeRequest("sell-4", { type: "BUY" }), {
      params: Promise.resolve({ id: "sell-4" }),
    })

    expect(res.status).toBe(200)
  })

  it("rejects growing a SELL beyond holdings", async () => {
    // Holds 10g (one BUY); editing the 4g SELL up to 12g would make the net
    // position -2g.
    setupMocks(SELL_4, [OTHER_BUY])

    const res = await PATCH(makeRequest("sell-4", { weightGram: 12 }), {
      params: Promise.resolve({ id: "sell-4" }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("Cannot sell more gold than you hold")
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("rejects shrinking a BUY below the sold amount", async () => {
    // Current: BUY 10g, SELL 4g → net 6g. Shrinking the BUY to 3g would make
    // the net -1g.
    setupMocks(OTHER_BUY, [SELL_4])

    const res = await PATCH(makeRequest("buy-10", { weightGram: 3 }), {
      params: Promise.resolve({ id: "buy-10" }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
