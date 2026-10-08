import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextResponse } from "next/server"

const mockRequireUser = vi.hoisted(() => vi.fn())
const mockGetAccessRecord = vi.hoisted(() => vi.fn())
const mockIsProUser = vi.hoisted(() => vi.fn())
const mockIsAdminUser = vi.hoisted(() => vi.fn())
const mockPlanLabel = vi.hoisted(() => vi.fn())
const mockPrismaCreate = vi.hoisted(() =>
  vi.fn((args: unknown) => {
    const data = (args as { data?: Record<string, unknown> }).data ?? {}
    return {
      id: "tx-1",
      type: (data.type as string) ?? "EXPENSE",
      category: (data.category as string) ?? "Food",
      amount: (data.amount as number) ?? 10000,
      description: (data.description as string) ?? "Groceries",
      notes: data.notes ?? null,
      date: new Date(),
    }
  }),
)

vi.mock("@/lib/api-access", () => ({ requireUser: mockRequireUser }))
vi.mock("@/lib/account-access", () => ({ getAccessRecord: mockGetAccessRecord }))
vi.mock("@/lib/subscription", () => ({
  isProUser: mockIsProUser,
  isAdminUser: mockIsAdminUser,
  planLabel: mockPlanLabel,
}))
const mockPrismaFindMany = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      create: mockPrismaCreate,
    },
    category: {
      findMany: mockPrismaFindMany,
    },
  },
}))

const { POST } = await import("../route")

function _messages(...items: Array<{ role: "user" | "assistant"; content: string; _state?: unknown }>) {
  return items
}

function userMsg(content: string, state?: unknown) {
  return { role: "user", content, _state: state }
}

function assistantMsg(content: string, state?: unknown) {
  return { role: "assistant", content, _state: state }
}

describe("POST /api/chat — interactive add-transaction flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUser.mockResolvedValue("user-1")
    mockGetAccessRecord.mockResolvedValue({
      role: "USER",
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: null,
      suspended: false,
    })
    mockIsProUser.mockReturnValue(true)
    mockIsAdminUser.mockReturnValue(false)
    mockPlanLabel.mockReturnValue("Free")
    mockPrismaCreate.mockImplementation((args: unknown) => {
      const data = (args as { data?: Record<string, unknown> }).data ?? {}
      return {
        id: "tx-1",
        type: (data.type as string) ?? "EXPENSE",
        category: (data.category as string) ?? "Food",
        amount: (data.amount as number) ?? 10000,
        notes: data.notes ?? null,
        date: new Date(),
      }
    })
    mockPrismaFindMany.mockResolvedValue([
      { name: "Salary" },
      { name: "Food" },
      { name: "Transport" },
      { name: "Other" },
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rejects unauthenticated requests", async () => {
    const unauthorizedResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    mockRequireUser.mockResolvedValueOnce(unauthorizedResponse)

    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("hello")] }),
    }))

    expect(res.status).toBe(401)
  })

  it("re-prompts type when the answer is unrecognizable", async () => {
    const state = { flow: "add-transaction-field", data: { amount: 10000 }, field: "type" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("blah"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.field).toBe("type")
    expect(body.message).toContain("Income or Expense")
  })

  it("re-prompts amount when the amount is missing", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE" }, field: "amount" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("nothing here"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.field).toBe("amount")
    expect(body.message).toContain("amount")
  })

  it("re-prompts category when the category is empty", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000 }, field: "category" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("for"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.field).toBe("category")
    expect(body.message).toContain("category name")
  })

  it("prompts notes after a recognized category is provided", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000 }, field: "category" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("Food"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.field).toBe("notes")
  })

  it("re-asks category when the user gives an unrecognized category", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000 }, field: "category" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("Pizza"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.field).toBe("category")
    expect(body.message).toContain("Pizza")
    expect(body.message.toLowerCase()).toContain("don't have a category")
    expect(body._state).toMatchObject({ flow: "add-transaction-field", field: "category" })
  })

  it("creates the transaction after the notes prompt with a 'no' answer", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000, category: "Food" }, field: "notes" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("No"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kind).toBe("feature")
    expect(body.message).toContain("Done")
    expect(body._state).toMatchObject({ flow: "idle" })
    expect(mockPrismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "EXPENSE",
          category: "Food",
          amount: 10000,
          userId: "user-1",
        }),
      }),
    )
  })

  it("creates the transaction with a note after the notes prompt", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000, category: "Food" }, field: "notes" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("Note: weekly shop"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kind).toBe("feature")
    expect(body.message).toContain("weekly shop")
    expect(mockPrismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "EXPENSE",
          category: "Food",
          amount: 10000,
          userId: "user-1",
        }),
      }),
    )
  })

  it("handles negative amounts as expenses", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [userMsg("add transaction -10000")],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    // Negative amount -> expense, and since type is now known the flow
    // skips to the next unanswered field (category).
    expect(body._state).toMatchObject({ data: { type: "EXPENSE", amount: 10000 } })
    expect(body.field).toBe("category")
  })

  it("allows correcting the amount mid-flow", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000 }, field: "amount" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("placeholder", state),
          userMsg("actually 20000"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body._state).toMatchObject({ data: { type: "EXPENSE", amount: 20000 } })
  })

  it("starts the add-transaction flow for add transaction 10000", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("Hi! Try asking for help.", { flow: "idle" }),
          userMsg("add transaction 10000"),
        ],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    // "add transaction 10000" does not infer type, so the bot defaults to expense
    // and asks for category next in the amount-first flow.
    expect(body.kind).toBe("prompt")
    expect(body.field).toBe("category")
    expect(body.message).toContain("category")
    expect(body._state).toMatchObject({ flow: "add-transaction-field", data: { amount: 10000, type: "EXPENSE" } })
  })

  it("starts the add-transaction flow for add expense 10000", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [userMsg("add expense 10000")],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    // Amount-first flow: type is already known, so next unanswered field is category.
    expect(body.kind).toBe("prompt")
    expect(body.field).toBe("category")
    expect(body.message).toContain("category")
    expect(body._state).toMatchObject({ flow: "add-transaction-field", data: { amount: 10000, type: "EXPENSE" } })
  })

  it("starts the add-transaction flow for add income 10000", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [userMsg("add income 10000")],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body._state).toMatchObject({ flow: "add-transaction-field", data: { amount: 10000, type: "INCOME" } })
  })
})
