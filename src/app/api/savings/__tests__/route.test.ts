import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())
const mockGetRateLimitKey = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bankSaving: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: mockGetRateLimitKey,
}))

// Import after mocks
const { GET } = await import("../route")

// ─── Tests ───────────────────────────────────

describe("GET /api/savings — auth & rate limit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when the user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET(new Request("http://localhost/api/savings?page=1"))
    expect(res.status).toBe(401)
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})

describe("GET /api/savings — summary ignores search filter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockRateLimit.mockResolvedValue({ allowed: true })
    mockGetRateLimitKey.mockReturnValue("ip-1")
  })

  it("computes the summary over ALL records, ignoring the search filter", async () => {
    // The search filter only narrows the list/count; the summary (total
    // deposits, withdrawals, net savings, and per-account balances) must
    // reflect every record the user owns.
    const listItems = [
      {
        id: "s-1",
        type: "DEPOSIT",
        accountName: "BCA",
        amount: 1_000_000,
        date: new Date(),
        notes: "Gaji",
      },
    ]
    const allItems = [
      { type: "DEPOSIT", accountName: "BCA", amount: 1_000_000 },
      { type: "WITHDRAWAL", accountName: "BCA", amount: 200_000 },
      { type: "DEPOSIT", accountName: "Mandiri", amount: 500_000 },
    ]
    mockCount.mockResolvedValue(1)
    mockFindMany.mockResolvedValueOnce(listItems).mockResolvedValueOnce(allItems)

    const req = new Request(
      "http://localhost/api/savings?page=1&pageSize=25&search=Gaji"
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    // List + count still apply the search filter.
    expect(mockFindMany.mock.calls[0][0].where).toMatchObject({
      userId: "user-1",
      OR: [
        { accountName: { contains: "Gaji", mode: "insensitive" } },
        { notes: { contains: "Gaji", mode: "insensitive" } },
      ],
    })
    expect(mockCount).toHaveBeenCalledWith({
      where: mockFindMany.mock.calls[0][0].where,
    })

    // The summary aggregation ignores the search — userId only.
    expect(mockFindMany.mock.calls[1][0].where).toEqual({ userId: "user-1" })

    // Summary reflects ALL accounts/records.
    expect(body.summary.totalDeposits).toBe(1_500_000)
    expect(body.summary.totalWithdrawals).toBe(200_000)
    expect(body.summary.netSavings).toBe(1_300_000)
    expect(body.summary.uniqueAccounts).toBe(2)
    expect(body.summary.accountSummaries).toEqual([
      { name: "BCA", deposits: 1_000_000, withdrawals: 200_000, balance: 800_000 },
      { name: "Mandiri", deposits: 500_000, withdrawals: 0, balance: 500_000 },
    ])
    // The list is still filtered.
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("s-1")
  })
})