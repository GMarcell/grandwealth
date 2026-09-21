import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks (available before module instantiation) ───

const mockAuth = vi.hoisted(() => vi.fn())
const mockCreateMany = vi.hoisted(() => vi.fn())
const mockRateLimit = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: { createMany: mockCreateMany },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  getRateLimitKey: vi.fn(),
}))

// Import after mocks
const { POST } = await import("../route")

// ─── Helpers ─────────────────────────────────

const HEADER = "type,category,amount,description,date"

/** Build a multipart request carrying `content` as the uploaded CSV file. */
function uploadRequest(content: string, fileName = "transactions.csv") {
  const formData = new FormData()
  formData.append("file", new File([content], fileName, { type: "text/csv" }))
  return new Request("http://localhost/api/transactions/import", {
    method: "POST",
    body: formData,
  })
}

function signIn() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  mockRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetTime: Date.now() + 60_000,
    limit: 5,
  })
  mockCreateMany.mockResolvedValue({ count: 1 })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests ───────────────────────────────────

describe("POST /api/transactions/import", () => {
  it("requires authentication", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await POST(uploadRequest(`${HEADER}\nEXPENSE,FOOD,10,Lunch,2026-09-01`))

    expect(res.status).toBe(401)
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it("rejects a missing file", async () => {
    signIn()

    const res = await POST(
      new Request("http://localhost/api/transactions/import", {
        method: "POST",
        body: new FormData(),
      }),
    )

    expect(res.status).toBe(400)
  })

  it("is rate limited per user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      limit: 5,
    })

    const res = await POST(uploadRequest(`${HEADER}\nEXPENSE,FOOD,10,Lunch,2026-09-01`))

    expect(res.status).toBe(429)
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it("imports a valid CSV", async () => {
    signIn()

    const res = await POST(
      uploadRequest(
        `${HEADER}\nEXPENSE,FOOD,10,Lunch,2026-09-01\nINCOME,SALARY,1000,Pay,2026-09-02`,
      ),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.imported).toBe(2)
    expect(mockCreateMany).toHaveBeenCalledTimes(1)
  })

  it("normalises categories the same way the rest of the app stores them", async () => {
    signIn()

    await POST(uploadRequest(`${HEADER}\nEXPENSE,Food and Drink,10,Lunch,2026-09-01`))

    const rows = mockCreateMany.mock.calls[0][0].data
    expect(rows[0].category).toBe("FOOD_AND_DRINK")
  })

  it("rejects a malformed CSV as a client error, not a 500", async () => {
    signIn()

    // Unterminated quoted field — parseCsv throws on this.
    const res = await POST(
      uploadRequest(`${HEADER}\nEXPENSE,FOOD,10,"Lunch,2026-09-01`),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("Could not parse")
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it("rejects a CSV that is too large", async () => {
    signIn()

    const filler = "x".repeat(2 * 1024 * 1024 + 1)
    const res = await POST(
      uploadRequest(`${HEADER}\nEXPENSE,FOOD,10,${filler},2026-09-01`),
    )
    const body = await res.json()

    expect(res.status).toBe(413)
    expect(body.error).toContain("too large")
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it("rejects a CSV with too many rows", async () => {
    signIn()

    const rows = Array.from({ length: 5_001 }, () => "EXPENSE,FOOD,10,Lunch,2026-09-01")
    const res = await POST(uploadRequest([HEADER, ...rows].join("\n")))
    const body = await res.json()

    expect(res.status).toBe(413)
    expect(body.error).toContain("too many rows")
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it("reports row-level errors but still imports the valid rows", async () => {
    signIn()

    const res = await POST(
      uploadRequest(
        `${HEADER}\nEXPENSE,FOOD,10,Lunch,2026-09-01\nBOGUS,FOOD,10,Bad,2026-09-01`,
      ),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.imported).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].line).toBe(3)
  })

  it("returns 400 when no row is valid", async () => {
    signIn()

    const res = await POST(uploadRequest(`${HEADER}\nEXPENSE,FOOD,-5,Bad,2026-09-01`))

    expect(res.status).toBe(400)
    expect(mockCreateMany).not.toHaveBeenCalled()
  })
})
