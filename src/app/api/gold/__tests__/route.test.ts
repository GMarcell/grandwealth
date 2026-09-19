import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    goldDeposit: {
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
    },
  },
}))

/** Entitled user shape returned by the Pro guard's user lookup. */
const PRO_USER = {
  role: "USER",
  plan: "PRO",
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  suspended: false,
}

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Import after mocks
const { GET, POST } = await import("../route")

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
  mockFindUser.mockResolvedValue(PRO_USER)
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

  it("returns 403 when the user is on the Free plan (gold is Pro-only)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUser.mockResolvedValue({
      role: "USER",
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      suspended: false,
    })

    const res = await POST(makeRequest({ type: "BUY", weightGram: 1, pricePerGram: 1_000_000 }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Pro subscription required")
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

describe("GET /api/gold — summary ignores filters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUser.mockResolvedValue(PRO_USER)
    mockRateLimit.mockResolvedValue({ allowed: true })
    mockGetRateLimitKey.mockReturnValue("ip-1")
  })

  it("computes the summary over ALL records, ignoring search and type filters", async () => {
    // List/count see only the filtered subset; the summary aggregation must
    // see the user's full portfolio (10g bought − 4g sold = 6g held).
    const listItems = [
      {
        id: "d-buy-10",
        type: "BUY",
        weightGram: 10,
        pricePerGram: 1_000_000,
        totalAmount: 10_000_000,
        date: new Date(),
        notes: "Antam",
      },
    ]
    const allItems = [
      { type: "BUY", weightGram: 10, totalAmount: 10_000_000 },
      { type: "SELL", weightGram: 4, totalAmount: 4_000_000 },
    ]
    mockCount.mockResolvedValue(1)
    mockFindMany.mockResolvedValueOnce(listItems).mockResolvedValueOnce(allItems)

    const req = new Request(
      "http://localhost/api/gold?page=1&pageSize=25&search=Antam&type=BUY"
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    // List + count still apply the search/type filters.
    expect(mockFindMany.mock.calls[0][0].where).toMatchObject({
      userId: "user-1",
      notes: { contains: "Antam", mode: "insensitive" },
      type: "BUY",
    })
    expect(mockCount).toHaveBeenCalledWith({
      where: mockFindMany.mock.calls[0][0].where,
    })

    // The summary aggregation ignores filters — userId only.
    expect(mockFindMany.mock.calls[1][0].where).toEqual({ userId: "user-1" })

    // Summary reflects the FULL portfolio (10g bought − 4g sold = 6g held).
    expect(body.summary).toEqual({
      totalWeight: 6,
      totalInvested: 6_000_000,
    })
    // The list is still filtered.
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("d-buy-10")
  })
})
