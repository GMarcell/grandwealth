import { describe, it, expect, vi, beforeEach } from "vitest"

const mockCreate = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    widgetToken: {
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}))

const { createWidgetToken, resolveWidgetToken, hashWidgetToken } = await import(
  "../widget-token"
)

describe("hashWidgetToken", () => {
  it("is deterministic", () => {
    expect(hashWidgetToken("abc")).toBe(hashWidgetToken("abc"))
  })

  it("produces different hashes for different tokens", () => {
    expect(hashWidgetToken("abc")).not.toBe(hashWidgetToken("abd"))
  })

  it("never returns the plaintext", () => {
    expect(hashWidgetToken("gw_widget_secret")).not.toContain("secret")
  })
})

describe("createWidgetToken", () => {
  beforeEach(() => vi.clearAllMocks())

  it("stores only the hash and returns the plaintext once", async () => {
    mockCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "wt-1", ...data }),
    )

    const result = await createWidgetToken("user-1", "iPhone")

    expect(result.token).toMatch(/^gw_widget_/)
    const stored = mockCreate.mock.calls[0][0].data
    expect(stored.tokenHash).toBe(hashWidgetToken(result.token))
    expect(stored.tokenHash).not.toBe(result.token)
    expect(stored.userId).toBe("user-1")
    expect(stored.label).toBe("iPhone")
  })

  it("generates unique tokens", async () => {
    mockCreate.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "wt", ...data }),
    )
    const a = await createWidgetToken("user-1")
    const b = await createWidgetToken("user-1")
    expect(a.token).not.toBe(b.token)
  })
})

describe("resolveWidgetToken", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null for a missing token", async () => {
    expect(await resolveWidgetToken(null)).toBeNull()
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it("returns null for an unknown token", async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await resolveWidgetToken("gw_widget_nope")).toBeNull()
  })

  it("looks up by hash, never the plaintext", async () => {
    mockFindUnique.mockResolvedValue({ id: "wt-1", userId: "user-1" })
    mockUpdate.mockResolvedValue({})

    await resolveWidgetToken("gw_widget_secret")

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashWidgetToken("gw_widget_secret") },
    })
  })

  it("returns the owning user id", async () => {
    mockFindUnique.mockResolvedValue({ id: "wt-1", userId: "user-1" })
    mockUpdate.mockResolvedValue({})
    expect(await resolveWidgetToken("gw_widget_secret")).toEqual({
      userId: "user-1",
    })
  })
})
