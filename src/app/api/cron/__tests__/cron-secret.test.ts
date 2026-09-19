import { describe, it, expect, vi, afterEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockStockFindMany = vi.hoisted(() => vi.fn())
const mockStockUpdate = vi.hoisted(() => vi.fn())
const mockUserFindMany = vi.hoisted(() => vi.fn())
const mockUserUpdateMany = vi.hoisted(() => vi.fn())
const mockFetchStockPrices = vi.hoisted(() => vi.fn())
const mockApplyDue = vi.hoisted(() => vi.fn())
const mockGenerateAnalysis = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stock: { findMany: mockStockFindMany, update: mockStockUpdate },
    user: { findMany: mockUserFindMany, updateMany: mockUserUpdateMany },
  },
}))

vi.mock("@/lib/prices", () => ({ fetchStockPrices: mockFetchStockPrices }))
vi.mock("@/lib/recurring", () => ({
  applyDueRecurringTransactions: mockApplyDue,
}))
vi.mock("@/lib/analysis-generator", () => ({
  generateAnalysisForUserAndMonth: mockGenerateAnalysis,
}))

// Import after mocks
const { GET: updatePricesGET } = await import("../update-prices/route")
const { GET: applyRecurringGET } = await import("../apply-recurring/route")
const { GET: monthlyAnalysisGET } = await import("../monthly-analysis/route")

// ─── Helpers ─────────────────────────────────

const SECRET = "test-cron-secret"

const routes: Array<{ name: string; get: (req: Request) => Promise<Response> }> = [
  { name: "update-prices", get: updatePricesGET },
  { name: "apply-recurring", get: applyRecurringGET },
  { name: "monthly-analysis", get: monthlyAnalysisGET },
]

const makeRequest = (secret?: string) =>
  new Request(
    `http://localhost/api/cron/test${secret ? `?secret=${secret}` : ""}`
  )

// ─── Tests ───────────────────────────────────

describe("cron endpoints — CRON_SECRET fail-closed", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET
    delete process.env.GROQ_API_KEY
    vi.clearAllMocks()
  })

  it.each(routes)(
    "$name returns 500 and does not execute when CRON_SECRET is unset",
    async ({ get }) => {
      delete process.env.CRON_SECRET

      const res = await get(makeRequest())
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error).toBe("CRON_SECRET not configured")
      // No side effect may run without a configured secret.
      expect(mockStockFindMany).not.toHaveBeenCalled()
      expect(mockStockUpdate).not.toHaveBeenCalled()
      expect(mockUserFindMany).not.toHaveBeenCalled()
      expect(mockApplyDue).not.toHaveBeenCalled()
      expect(mockGenerateAnalysis).not.toHaveBeenCalled()
    }
  )

  it.each(routes)(
    "$name returns 401 for a wrong secret",
    async ({ get }) => {
      process.env.CRON_SECRET = SECRET

      const res = await get(makeRequest("wrong-secret"))
      expect(res.status).toBe(401)
      expect(mockStockFindMany).not.toHaveBeenCalled()
      expect(mockUserFindMany).not.toHaveBeenCalled()
      expect(mockApplyDue).not.toHaveBeenCalled()
    }
  )

  it("update-prices proceeds with a valid secret", async () => {
    process.env.CRON_SECRET = SECRET
    mockUserUpdateMany.mockResolvedValue({ count: 0 }) // trial sweep
    mockStockFindMany.mockResolvedValue([])

    const res = await updatePricesGET(makeRequest(SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdateMany).toHaveBeenCalled()
    expect(mockStockFindMany).toHaveBeenCalled()
  })

  it("apply-recurring proceeds with a valid secret", async () => {
    process.env.CRON_SECRET = SECRET
    mockApplyDue.mockResolvedValue({ created: 1, deactivated: 0 })

    const res = await applyRecurringGET(makeRequest(SECRET))
    expect(res.status).toBe(200)
    expect(mockApplyDue).toHaveBeenCalled()
  })
})