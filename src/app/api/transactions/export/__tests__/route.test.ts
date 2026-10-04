import { describe, it, expect, vi, beforeEach } from "vitest"

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindMany = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({
  prisma: { transaction: { findMany: mockFindMany } },
}))

const { GET } = await import("../route")

function tx(overrides: Record<string, unknown> = {}) {
  return {
    type: "EXPENSE",
    category: "FOOD",
    amount: 50000,
    description: "Lunch",
    date: new Date("2026-09-21T10:00:00.000Z"),
    ...overrides,
  }
}

describe("GET /api/transactions/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("streams a CSV with a header and the user's rows", async () => {
    mockFindMany.mockResolvedValueOnce([tx()])

    const res = await GET()
    const text = await res.text()

    expect(res.headers.get("Content-Type")).toBe("text/csv")
    expect(res.headers.get("Content-Disposition")).toContain("transactions-export-")
    const lines = text.trim().split("\n")
    expect(lines[0]).toBe("type,category,amount,description,date")
    expect(lines[1]).toBe("EXPENSE,FOOD,50000,Lunch,2026-09-21")
  })

  it("scopes the query to the session user and selects only exported columns", async () => {
    mockFindMany.mockResolvedValueOnce([])

    await (await GET()).text()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        skip: 0,
        take: 1000,
        select: {
          type: true,
          category: true,
          amount: true,
          description: true,
          date: true,
        },
      }),
    )
  })

  it("escapes CSV-special characters in fields", async () => {
    mockFindMany.mockResolvedValueOnce([
      tx({ description: 'Lunch, "special"', category: "FOOD" }),
    ])

    const text = await (await GET()).text()

    expect(text).toContain('"Lunch, ""special"""')
  })

  it("pages until a short batch is returned", async () => {
    // First batch is full (triggers a second page), second batch ends the loop.
    mockFindMany
      .mockResolvedValueOnce(Array.from({ length: 1000 }, () => tx()))
      .mockResolvedValueOnce([tx({ description: "Last" })])

    const res = await GET()
    const text = await res.text()

    expect(mockFindMany).toHaveBeenCalledTimes(2)
    expect(mockFindMany.mock.calls[1][0]).toMatchObject({ skip: 1000, take: 1000 })
    // header + 1000 + 1 data rows
    expect(text.trim().split("\n")).toHaveLength(1002)
  })
})
