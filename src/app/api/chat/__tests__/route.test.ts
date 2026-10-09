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
const mockPrismaFindUnique = vi.hoisted(() => vi.fn())
const mockPrismaDelete = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      create: mockPrismaCreate,
      findUnique: mockPrismaFindUnique,
      delete: mockPrismaDelete,
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
        description: (data.description as string) ?? "Groceries",
        notes: data.notes ?? null,
        date: new Date(),
      }
    })
    mockPrismaFindMany.mockResolvedValue([
      { name: "Salary", type: "INCOME" },
      { name: "Groceries", type: "EXPENSE" },
    ])
    mockPrismaFindUnique.mockResolvedValue(null)
    mockPrismaDelete.mockResolvedValue({})
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

  it("suggests only categories matching the chosen type", async () => {
    const expenseRes = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add expense 10000")] }),
    }))
    const expenseBody = await expenseRes.json()
    expect(expenseBody.field).toBe("category")
    // Predefined expenses are offered; income categories are not.
    expect(expenseBody.suggestions).toContain("Food")
    expect(expenseBody.suggestions).not.toContain("Salary")

    const incomeRes = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add income 10000")] }),
    }))
    const incomeBody = await incomeRes.json()
    expect(incomeBody.field).toBe("category")
    expect(incomeBody.suggestions).toContain("Salary")
    expect(incomeBody.suggestions).not.toContain("Food")
  })

  it("rejects a category that belongs to the other type", async () => {
    // Type is EXPENSE, so the income category "Salary" must not be accepted.
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000 }, field: "category" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg("placeholder", state), userMsg("Salary")],
      }),
    }))

    const body = await res.json()
    expect(body.field).toBe("category")
    expect(body.message).toContain("Salary")
  })

  it("matches an existing category case-insensitively and stores its canonical name", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000 }, field: "category" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg("placeholder", state), userMsg("groceries")],
      }),
    }))

    const body = await res.json()
    expect(body.field).toBe("notes")
    expect(body._state.data.category).toBe("Groceries")
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

  it("starts the add-transaction flow for add transaction 10000 by asking for the type", async () => {
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
    // "add transaction 10000" does not infer type, so the bot must ask
    // whether it is an expense or an income before anything else.
    expect(body.kind).toBe("prompt")
    expect(body.field).toBe("type")
    expect(body.message).toContain("expense")
    expect(body.suggestions).toEqual(["Expense", "Income"])
    expect(body._state).toMatchObject({ flow: "add-transaction-field", data: { amount: 10000 } })
    expect(body._state.data).not.toHaveProperty("type")
  })

  it("walks through type → category → notes and creates the transaction", async () => {
    // 1) Start with just an amount.
    const start = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add transaction 10000")] }),
    }))
    const startBody = await start.json()
    expect(startBody.field).toBe("type")

    // 2) Answer the type question.
    const typeRes = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg(startBody.message, startBody._state), userMsg("Expense")],
      }),
    }))
    const typeBody = await typeRes.json()
    expect(typeBody.field).toBe("category")
    expect(typeBody._state.data).toMatchObject({ type: "EXPENSE", amount: 10000 })

    // 3) Answer the category question.
    const catRes = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg(typeBody.message, typeBody._state), userMsg("Groceries")],
      }),
    }))
    const catBody = await catRes.json()
    expect(catBody.field).toBe("notes")

    // 4) Answer the notes question.
    const notesRes = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg(catBody.message, catBody._state), userMsg("lunch with team")],
      }),
    }))
    const notesBody = await notesRes.json()
    expect(notesBody.kind).toBe("feature")
    expect(notesBody.message).toContain("Done")
    expect(notesBody.message).toContain("lunch with team")
    expect(notesBody._state).toMatchObject({ flow: "idle" })
    expect(mockPrismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "EXPENSE",
          category: "Groceries",
          amount: 10000,
          notes: "lunch with team",
          userId: "user-1",
        }),
      }),
    )
  })

  it("skips notes when the user replies 'skip'", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000, category: "Food" }, field: "notes" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg("placeholder", state), userMsg("skip")],
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kind).toBe("feature")
    expect(mockPrismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: null }),
      }),
    )
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

  it("adds type, amount, category and notes from a single message", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add expense 25000 Groceries lunch with team")] }),
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
          amount: 25000,
          category: "Groceries",
          notes: "lunch with team",
          userId: "user-1",
        }),
      }),
    )
  })

  it("one-shot resolves a predefined category and leaves notes empty", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add income 5000000 Salary")] }),
    }))

    const body = await res.json()
    expect(body.kind).toBe("feature")
    expect(mockPrismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "INCOME",
          amount: 5000000,
          category: "SALARY",
          notes: null,
        }),
      }),
    )
  })

  it("finishes in one shot once the type is answered", async () => {
    const start = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add transaction 25000 Groceries")] }),
    }))
    const startBody = await start.json()
    // Type isn't known yet, so it still asks first.
    expect(startBody.field).toBe("type")

    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg(startBody.message, startBody._state), userMsg("Expense")],
      }),
    }))
    const body = await res.json()
    expect(body.kind).toBe("feature")
    expect(mockPrismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "EXPENSE", amount: 25000, category: "Groceries" }),
      }),
    )
  })

  it("asks for the category when the one-shot category is unknown", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add expense 25000 pizza")] }),
    }))

    const body = await res.json()
    expect(body.kind).toBe("prompt")
    expect(body.field).toBe("category")
  })

  it("parses Indonesian thousands separators (10.000 -> 10000)", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add transaction 10.000")] }),
    }))

    const body = await res.json()
    expect(body.field).toBe("type")
    expect(body._state.data.amount).toBe(10000)
  })

  it("parses English thousands separators (10,000 -> 10000)", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add transaction 10,000")] }),
    }))

    const body = await res.json()
    expect(body._state.data.amount).toBe(10000)
  })

  it("one-shot honours a formatted amount with a category", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [userMsg("add expense 1.500.000 Groceries")] }),
    }))

    const body = await res.json()
    expect(body.kind).toBe("feature")
    expect(mockPrismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 1500000, category: "Groceries" }),
      }),
    )
  })

  it("starts a fresh flow for 'add another transaction'", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          assistantMsg("Done!", { flow: "idle", data: { lastTransactionId: "tx-1" } }),
          userMsg("Add another transaction"),
        ],
      }),
    }))

    const body = await res.json()
    expect(body.kind).toBe("prompt")
    expect(body.field).toBe("type")
    expect(body._state).toMatchObject({ flow: "add-transaction-field" })
    // A fresh flow must not carry the previous transaction id.
    expect(body._state.data.lastTransactionId).toBeUndefined()
  })

  it("cancels an in-progress flow without saving", async () => {
    const state = { flow: "add-transaction-field", data: { type: "EXPENSE", amount: 10000, category: "Groceries" }, field: "notes" }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg("placeholder", state), userMsg("cancel")],
      }),
    }))

    const body = await res.json()
    expect(body.kind).toBe("text")
    expect(body.message.toLowerCase()).toContain("cancel")
    expect(body._state).toMatchObject({ flow: "idle" })
    expect(mockPrismaCreate).not.toHaveBeenCalled()
  })

  it("undoes the transaction the bot just created", async () => {
    mockPrismaFindUnique.mockResolvedValue({
      id: "tx-1",
      userId: "user-1",
      type: "EXPENSE",
      amount: 10000,
      category: "Groceries",
    })
    const state = { flow: "idle", data: { lastTransactionId: "tx-1" } }
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg("Done!", state), userMsg("undo")],
      }),
    }))

    const body = await res.json()
    expect(body.kind).toBe("text")
    expect(body.message).toContain("removed")
    expect(mockPrismaDelete).toHaveBeenCalledWith({ where: { id: "tx-1" } })
    expect(body._state).toMatchObject({ flow: "idle" })
  })

  it("reports when there is nothing to undo", async () => {
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [assistantMsg("Hi", { flow: "idle" }), userMsg("undo")],
      }),
    }))

    const body = await res.json()
    expect(body.message.toLowerCase()).toContain("nothing to undo")
    expect(mockPrismaDelete).not.toHaveBeenCalled()
  })
})
