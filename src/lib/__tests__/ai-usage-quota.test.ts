import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetAccessRecord = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/account-access", () => ({
  getAccessRecord: mockGetAccessRecord,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiUsage: {
      count: mockCount,
      create: mockCreate,
    },
  },
}))

const { checkGroqQuota, consumeGroqQuota, PRO_GROQ_MONTHLY_LIMIT } =
  await import("../ai-usage-quota")

function user(overrides: Record<string, unknown> = {}) {
  return {
    role: "USER",
    plan: "FREE",
    subscriptionStatus: null,
    currentPeriodEnd: null,
    suspended: false,
    ...overrides,
  }
}

function proUser(overrides: Record<string, unknown> = {}) {
  return user({ plan: "PRO", subscriptionStatus: "ACTIVE", ...overrides })
}

describe("checkGroqQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows a Pro+ account without limit", async () => {
    mockGetAccessRecord.mockResolvedValue(user({ plan: "PRO_PLUS", subscriptionStatus: "ACTIVE" }))
    mockCount.mockResolvedValue(999)

    const result = await checkGroqQuota("user-1")

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(Infinity)
    expect(result.limit).toBe(0)
  })

  it("allows an admin account without limit", async () => {
    mockGetAccessRecord.mockResolvedValue(user({ role: "ADMIN" }))
    mockCount.mockResolvedValue(999)

    const result = await checkGroqQuota("admin-1")

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(Infinity)
    expect(result.limit).toBe(0)
  })

  it("denies a Pro account once the monthly cap is reached", async () => {
    mockGetAccessRecord.mockResolvedValue(proUser())
    mockCount.mockResolvedValue(PRO_GROQ_MONTHLY_LIMIT)

    const result = await checkGroqQuota("user-1")

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.limit).toBe(PRO_GROQ_MONTHLY_LIMIT)
  })

  it("allows a Pro account while quota remains", async () => {
    mockGetAccessRecord.mockResolvedValue(proUser())
    mockCount.mockResolvedValue(2)

    const result = await checkGroqQuota("user-1")

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(PRO_GROQ_MONTHLY_LIMIT - 2)
    expect(result.limit).toBe(PRO_GROQ_MONTHLY_LIMIT)
  })

  it("denies an unknown user", async () => {
    mockGetAccessRecord.mockResolvedValue(null)

    const result = await checkGroqQuota("missing")

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe("consumeGroqQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not record anything and returns Infinity for Pro+", async () => {
    mockGetAccessRecord.mockResolvedValue(user({ plan: "PRO_PLUS", subscriptionStatus: "ACTIVE" }))

    const remaining = await consumeGroqQuota("user-1")

    expect(remaining).toBe(Infinity)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("does not record anything and returns Infinity for admin", async () => {
    mockGetAccessRecord.mockResolvedValue(user({ role: "ADMIN" }))

    const remaining = await consumeGroqQuota("admin-1")

    expect(remaining).toBe(Infinity)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("records a usage entry for a Pro account and returns the new remaining", async () => {
    mockGetAccessRecord.mockResolvedValue(proUser())
    mockCount.mockResolvedValue(2)
    mockCreate.mockResolvedValue({ id: "usage-1" })

    const remaining = await consumeGroqQuota("user-1")

    expect(remaining).toBe(PRO_GROQ_MONTHLY_LIMIT - 3)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", monthKey: expect.any(String) },
    })
  })

  it("does not record past the cap and returns 0", async () => {
    mockGetAccessRecord.mockResolvedValue(proUser())
    mockCount.mockResolvedValue(PRO_GROQ_MONTHLY_LIMIT)
    mockCreate.mockResolvedValue({ id: "usage-1" })

    const remaining = await consumeGroqQuota("user-1")

    expect(remaining).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("returns 0 for an unknown user", async () => {
    mockGetAccessRecord.mockResolvedValue(null)

    const remaining = await consumeGroqQuota("missing")

    expect(remaining).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
