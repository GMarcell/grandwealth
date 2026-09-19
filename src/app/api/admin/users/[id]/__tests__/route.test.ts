import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mocks ────────────────────────────

const mockAuth = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      count: mockCount,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

// Import after mocks
const { PATCH, DELETE } = await import("../route")

// ─── Helpers ─────────────────────────────────

const ADMIN_SELECT = {
  role: "ADMIN",
  plan: "PRO",
  subscriptionStatus: "ACTIVE",
  currentPeriodEnd: null,
  suspended: false,
}

interface UserRow {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "USER"
  plan: "FREE" | "PRO"
  subscriptionStatus: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | null
  currentPeriodEnd: Date | null
  isTrial: boolean
  suspended: boolean
  createdAt: Date
}

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "user-2",
    name: "Jane",
    email: "jane@example.com",
    role: "USER",
    plan: "FREE",
    subscriptionStatus: null,
    currentPeriodEnd: null,
    isTrial: false,
    suspended: false,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  }
}

function makeRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/** Admin actor + the target row returned by the route's own lookup. */
function setupAdminActingOn(target: UserRow) {
  mockAuth.mockResolvedValue({ user: { id: "admin-1" } })
  // First findUnique = guard lookup (select shape), second = target lookup.
  mockFindUnique
    .mockResolvedValueOnce(ADMIN_SELECT)
    .mockResolvedValue(target)
}

const updatedUser = (row: UserRow, data: Record<string, unknown>): UserRow =>
  ({
    ...row,
    ...(data.plan !== undefined ? { plan: data.plan as UserRow["plan"] } : {}),
    ...(data.role !== undefined ? { role: data.role as UserRow["role"] } : {}),
    ...(data.suspended !== undefined ? { suspended: data.suspended as boolean } : {}),
    ...(data.isTrial !== undefined ? { isTrial: data.isTrial as boolean } : {}),
    subscriptionStatus: (data.subscriptionStatus as UserRow["subscriptionStatus"]) ?? row.subscriptionStatus,
    currentPeriodEnd: (data.currentPeriodEnd as Date | null) ?? row.currentPeriodEnd,
  })

// ─── Tests ───────────────────────────────────

describe("PATCH /api/admin/users/[id] — access control", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await PATCH(makeRequest("user-2", { plan: "PRO" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-admin users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockFindUnique.mockResolvedValueOnce({
      role: "USER",
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      suspended: false,
    })

    const res = await PATCH(makeRequest("user-2", { plan: "PRO" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/admin/users/[id] — self & last-admin protection", () => {
  beforeEach(() => vi.clearAllMocks())

  it("blocks an admin from demoting themselves", async () => {
    const self = userRow({ id: "admin-1", role: "ADMIN", email: "admin@example.com" })
    setupAdminActingOn(self)

    const res = await PATCH(makeRequest("admin-1", { role: "USER" }), {
      params: Promise.resolve({ id: "admin-1" }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("cannot demote your own account")
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("blocks an admin from suspending themselves", async () => {
    const self = userRow({ id: "admin-1", role: "ADMIN", email: "admin@example.com" })
    setupAdminActingOn(self)

    const res = await PATCH(makeRequest("admin-1", { suspended: true }), {
      params: Promise.resolve({ id: "admin-1" }),
    })
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("blocks demoting the last remaining admin", async () => {
    const target = userRow({ id: "user-2", role: "ADMIN", email: "boss@example.com" })
    setupAdminActingOn(target)
    mockCount.mockResolvedValue(0) // no other admins

    const res = await PATCH(makeRequest("user-2", { role: "USER" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("last administrator")
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("allows demoting an admin when another admin exists", async () => {
    const target = userRow({ id: "user-2", role: "ADMIN", email: "boss@example.com" })
    setupAdminActingOn(target)
    mockCount.mockResolvedValue(1)
    mockUpdate.mockResolvedValue(updatedUser(target, { role: "USER" }))

    const res = await PATCH(makeRequest("user-2", { role: "USER" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(200)
    expect(mockCount).toHaveBeenCalledWith({
      where: { role: "ADMIN", id: { not: "user-2" } },
    })
  })
})

describe("PATCH /api/admin/users/[id] — plan transitions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("downgrading to FREE clears subscription state", async () => {
    const pro = userRow({
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: new Date("2027-01-01"),
    })
    setupAdminActingOn(pro)
    mockUpdate.mockImplementation(
      async (args: { where: { id: string }; data: Record<string, unknown> }) =>
        updatedUser(pro, args.data)
    )

    const res = await PATCH(makeRequest("user-2", { plan: "FREE" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
    })
    expect(body.plan).toBe("FREE")
  })

  it("granting PRO without a status activates the subscription", async () => {
    setupAdminActingOn(userRow())
    mockUpdate.mockImplementation(
      async (args: { where: { id: string }; data: Record<string, unknown> }) =>
        updatedUser(userRow(), args.data)
    )

    const res = await PATCH(makeRequest("user-2", { plan: "PRO" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(200)

    const data = mockUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ plan: "PRO", subscriptionStatus: "ACTIVE" })
  })

  it("rejects an invalid period end date", async () => {
    setupAdminActingOn(userRow())

    const res = await PATCH(
      makeRequest("user-2", { plan: "PRO", currentPeriodEnd: "not-a-date" }),
      { params: Promise.resolve({ id: "user-2" }) }
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("Invalid period end")
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("manual grants are paid subscriptions, not trials, by default", async () => {
    setupAdminActingOn(userRow())
    mockUpdate.mockResolvedValue(updatedUser(userRow(), { plan: "PRO", isTrial: false }))

    const res = await PATCH(makeRequest("user-2", { plan: "PRO" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(200)

    const data = mockUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ plan: "PRO", subscriptionStatus: "ACTIVE", isTrial: false })
  })

  it("preserves an explicit trial grant", async () => {
    setupAdminActingOn(userRow())
    mockUpdate.mockResolvedValue(updatedUser(userRow(), { plan: "PRO", isTrial: true }))

    const res = await PATCH(makeRequest("user-2", { plan: "PRO", isTrial: true }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(200)

    const data = mockUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ plan: "PRO", isTrial: true })
  })

  it("clears the trial flag when an admin converts a trial to paid", async () => {
    const trialUser = userRow({
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      isTrial: true,
    })
    setupAdminActingOn(trialUser)
    mockUpdate.mockResolvedValue(updatedUser(trialUser, { plan: "PRO", isTrial: false }))

    const res = await PATCH(makeRequest("user-2", { plan: "PRO", isTrial: false }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(200)

    const data = mockUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ isTrial: false })
  })

  it("clears the trial flag when downgrading to FREE", async () => {
    const trialUser = userRow({
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      isTrial: true,
      currentPeriodEnd: new Date("2026-06-01"),
    })
    setupAdminActingOn(trialUser)
    mockUpdate.mockResolvedValue(updatedUser(trialUser, { plan: "FREE" }))

    const res = await PATCH(makeRequest("user-2", { plan: "FREE" }), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(200)

    const data = mockUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({
      plan: "FREE",
      subscriptionStatus: null,
      currentPeriodEnd: null,
      isTrial: false,
    })
  })
})

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("blocks deleting your own account", async () => {
    const self = userRow({ id: "admin-1", role: "ADMIN", email: "admin@example.com" })
    setupAdminActingOn(self)

    const res = await DELETE(new Request("http://localhost/api/admin/users/admin-1"), {
      params: Promise.resolve({ id: "admin-1" }),
    })
    expect(res.status).toBe(400)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("blocks deleting the last admin", async () => {
    const target = userRow({ id: "user-2", role: "ADMIN", email: "boss@example.com" })
    setupAdminActingOn(target)
    mockCount.mockResolvedValue(0)

    const res = await DELETE(new Request("http://localhost/api/admin/users/user-2"), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(400)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("deletes a regular user", async () => {
    setupAdminActingOn(userRow())
    mockDelete.mockResolvedValue({ id: "user-2" })

    const res = await DELETE(new Request("http://localhost/api/admin/users/user-2"), {
      params: Promise.resolve({ id: "user-2" }),
    })
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "user-2" } })
  })
})
