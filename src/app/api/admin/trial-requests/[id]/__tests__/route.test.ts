import { describe, it, expect, vi, beforeEach } from "vitest"
import { PRO_TRIAL_DAYS } from "@/lib/subscription"

// ─── Hoisted mocks ────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUser = vi.hoisted(() => vi.fn())
const mockFindRequest = vi.hoisted(() => vi.fn())
const mockTransaction = vi.hoisted(() => vi.fn())
const mockUpdateUser = vi.hoisted(() => vi.fn())
const mockUpdateRequest = vi.hoisted(() => vi.fn())
const mockNotifyUser = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUser },
    trialRequest: { findUnique: mockFindRequest },
    $transaction: mockTransaction,
  },
}))

vi.mock("@/lib/trial-request", async () => {
  const actual = await vi.importActual<typeof import("@/lib/trial-request")>(
    "@/lib/trial-request"
  )
  return { ...actual, notifyUserOfApprovedTrial: mockNotifyUser }
})

// Import after mocks
const { PATCH } = await import("../route")

// ─── Helpers ─────────────────────────────────

const ADMIN_SELECT = {
  role: "ADMIN",
  plan: "PRO",
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  suspended: false,
}

const pendingRequest = {
  id: "req-1",
  status: "PENDING" as const,
  user: { id: "user-2", email: "jane@example.com", suspended: false },
}

function call(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/admin/trial-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  )
}

describe("PATCH /api/admin/trial-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: "admin-1" } })
    mockFindUser.mockResolvedValue(ADMIN_SELECT)
    mockFindRequest.mockResolvedValue(pendingRequest)
    mockUpdateUser.mockResolvedValue({})
    mockUpdateRequest.mockResolvedValue({})
    mockNotifyUser.mockResolvedValue(undefined)
    // Run the transaction callback against a tx client with the same mocks.
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        user: { update: mockUpdateUser },
        trialRequest: { update: mockUpdateRequest },
      })
    )
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await call("req-1", { status: "APPROVED" })

    expect(res.status).toBe(401)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("returns 403 for non-admin callers", async () => {
    mockFindUser.mockResolvedValue({ ...ADMIN_SELECT, role: "USER", plan: "FREE" })

    const res = await call("req-1", { status: "APPROVED" })

    expect(res.status).toBe(403)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("returns 404 for an unknown request", async () => {
    mockFindRequest.mockResolvedValue(null)

    const res = await call("missing", { status: "APPROVED" })

    expect(res.status).toBe(404)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("approving grants 30 days of Pro and notifies the user", async () => {
    const before = Date.now()

    const res = await call("req-1", { status: "APPROVED" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, status: "APPROVED" })

    // The trial end lands ~PRO_TRIAL_DAYS out.
    const endsAt = new Date(body.trialEndsAt).getTime()
    const expected = before + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000
    expect(endsAt).toBeGreaterThanOrEqual(expected)
    expect(endsAt).toBeLessThanOrEqual(Date.now() + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000)

    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: {
        plan: "PRO",
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: new Date(body.trialEndsAt),
        isTrial: true,
      },
    })
    expect(mockUpdateRequest).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: {
        status: "APPROVED",
        decisionNote: null,
        decidedById: "admin-1",
        decidedAt: expect.any(Date),
      },
    })
    expect(mockNotifyUser).toHaveBeenCalledWith({
      userEmail: "jane@example.com",
      trialEndsAt: new Date(body.trialEndsAt),
    })
  })

  it("records a decision note when one is given", async () => {
    await call("req-1", { status: "DECLINED", note: "Try Budgets on Free first" })

    expect(mockUpdateRequest).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: {
        status: "DECLINED",
        decisionNote: "Try Budgets on Free first",
        decidedById: "admin-1",
        decidedAt: expect.any(Date),
      },
    })
  })

  it("declining leaves the plan untouched", async () => {
    const res = await call("req-1", { status: "DECLINED" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ status: "DECLINED", trialEndsAt: null })
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockNotifyUser).not.toHaveBeenCalled()
  })

  it("refuses to decide the same request twice", async () => {
    mockFindRequest.mockResolvedValue({ ...pendingRequest, status: "APPROVED" })

    const res = await call("req-1", { status: "APPROVED" })

    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe("This request was already approved")
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("rejects an unknown decision status", async () => {
    const res = await call("req-1", { status: "MAYBE" })

    expect(res.status).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it("does not fail the approval when the user email bounces", async () => {
    mockNotifyUser.mockRejectedValue(new Error("smtp down"))

    const res = await call("req-1", { status: "APPROVED" })

    expect(res.status).toBe(200)
    expect(mockUpdateUser).toHaveBeenCalled()
  })

  it("returns 500 when the transaction fails", async () => {
    mockTransaction.mockRejectedValue(new Error("db down"))

    const res = await call("req-1", { status: "APPROVED" })

    expect(res.status).toBe(500)
  })
})
