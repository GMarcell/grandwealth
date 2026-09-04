import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    goldDeposit: {
      findMany: mockFindMany,
      create: mockCreate,
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Import after mocks
const { POST } = await import("../route")

// ─── Helpers ─────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/gold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const deposit = (type: "BUY" | "SELL", weightGram: number) => ({
  id: `d-${type}-${weightGram}`,
  type,
  weightGram,
  pricePerGram: 1_000_000,
  totalAmount: weightGram * 1_000_000,
  date: new Date(),
  notes: null,
})

function setupMocks() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockRateLimit.mockResolvedValue({ allowed: true })
  mockCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    deposit(data.type as "BUY" | "SELL", data.weightGram as number)
  )
}

// ─── Tests ───────────────────────────────────

describe("POST /api/gold — auth & rate limit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await POST(makeRequest({ type: "BUY", weightGram: 1, pricePerGram: 1_000_000 }))
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe("POST /api/gold — oversell protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it("creates a BUY without checking holdings", async () => {
    mockFindMany.mockResolvedValue([])

    const res = await POST(makeRequest({ type: "BUY", weightGram: 10, pricePerGram: 1_000_000 }))

    expect(res.status).toBe(201)
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("creates a SELL within current holdings", async () => {
    mockFindMany.mockResolvedValue([deposit("BUY", 10)])

    const res = await POST(makeRequest({ type: "SELL", weightGram: 4, pricePerGram: 1_000_000 }))

    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("rejects a SELL larger than current holdings with 400", async () => {
    mockFindMany.mockResolvedValue([deposit("BUY", 10)])

    const res = await POST(makeRequest({ type: "SELL", weightGram: 15, pricePerGram: 1_000_000 }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("you only hold 10 g of gold")
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("rejects a SELL when nothing is held", async () => {
    mockFindMany.mockResolvedValue([])

    const res = await POST(makeRequest({ type: "SELL", weightGram: 1, pricePerGram: 1_000_000 }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("you only hold 0 g of gold")
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("allows a SELL that exactly matches holdings (down to zero)", async () => {
    mockFindMany.mockResolvedValue([deposit("BUY", 10)])

    const res = await POST(makeRequest({ type: "SELL", weightGram: 10, pricePerGram: 1_000_000 }))

    expect(res.status).toBe(201)
  })
})
