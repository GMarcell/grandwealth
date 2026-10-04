import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mockFindUnique } },
}))

const { requireUser, requireProUser, requireAdminUser } = await import("../api-access")

function access(overrides: Record<string, unknown> = {}) {
  return {
    role: "USER",
    plan: "FREE",
    subscriptionStatus: null,
    currentPeriodEnd: null,
    suspended: false,
    ...overrides,
  }
}

const statusOf = (value: string | NextResponse) =>
  value instanceof NextResponse ? value.status : 200

describe("requireUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when there is no session", async () => {
    mockAuth.mockResolvedValue(null)

    const result = await requireUser()

    expect(statusOf(result)).toBe(401)
    expect(result).toBeInstanceOf(NextResponse)
  })

  it("returns the user id for a signed-in account", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })

    expect(await requireUser()).toBe("user-1")
  })
})

describe("requireProUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    expect(statusOf(await requireProUser())).toBe(401)
  })

  it("returns 403 for a free account", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUnique.mockResolvedValue(access())

    expect(statusOf(await requireProUser())).toBe(403)
  })

  it("returns 403 for a suspended account", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUnique.mockResolvedValue(
      access({ plan: "PRO", subscriptionStatus: "ACTIVE", suspended: true }),
    )

    expect(statusOf(await requireProUser())).toBe(403)
  })

  it("returns the user id for an active Pro account", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUnique.mockResolvedValue(
      access({ plan: "PRO", subscriptionStatus: "ACTIVE" }),
    )

    expect(await requireProUser()).toBe("user-1")
  })
})

describe("requireAdminUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    expect(statusOf(await requireAdminUser())).toBe(401)
  })

  it("returns 403 for a non-admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUnique.mockResolvedValue(access())

    expect(statusOf(await requireAdminUser())).toBe(403)
  })

  it("returns the user id for an admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1" } })
    mockFindUnique.mockResolvedValue(access({ role: "ADMIN" }))

    expect(await requireAdminUser()).toBe("admin-1")
  })
})
