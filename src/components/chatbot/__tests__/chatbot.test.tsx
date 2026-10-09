import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Chatbot } from "../chatbot"

const START_STATE = {
  flow: "add-transaction-field",
  data: { amount: 10000 },
  field: "type",
}

type ChatCall = [url: string, init?: RequestInit]

/** Route the mount subscription fetch and the chat calls. */
function stubFetch(chatResponses: unknown[]) {
  let chatIndex = 0
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/user/subscription") {
      return { ok: true, json: async () => ({ isPro: false }) } as Response
    }
    if (url === "/api/chat") {
      const body = chatResponses[chatIndex++] ?? {}
      return { ok: true, json: async () => body } as Response
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("Chatbot add-transaction flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("echoes the server _state and sends a clicked suggestion", async () => {
    const fetchMock = stubFetch([
      {
        message: "Got it. Is this an expense or an income?",
        kind: "prompt",
        field: "type",
        suggestions: ["Expense", "Income"],
        _state: START_STATE,
      },
      {
        message: "Okay, expense of 10.000. Which category should I use?",
        kind: "prompt",
        field: "category",
        suggestions: ["Salary", "Food"],
        _state: { ...START_STATE, field: "category", data: { amount: 10000, type: "EXPENSE" } },
      },
    ])

    render(<Chatbot />)
    fireEvent.click(screen.getByLabelText("Open chatbot"))

    const input = screen.getByLabelText("Chat message")
    fireEvent.change(input, { target: { value: "add transaction 10000" } })
    fireEvent.submit(input.closest("form")!)

    // The bot asks whether it's an expense or an income.
    await screen.findByText(/expense or an income/i)

    // Clicking the suggestion must actually send its text (not an empty input).
    fireEvent.click(screen.getByRole("button", { name: "Expense" }))

    await waitFor(() => {
      const chatCalls = fetchMock.mock.calls.filter(
        (call) => (call as ChatCall)[0] === "/api/chat",
      )
      expect(chatCalls).toHaveLength(2)
    })

    const chatCalls = fetchMock.mock.calls.filter(
      (call) => (call as ChatCall)[0] === "/api/chat",
    ) as unknown as ChatCall[]
    const secondBody = JSON.parse(chatCalls[1][1]!.body as string)

    // The assistant message's _state must be echoed back so the flow resumes.
    const assistantWithState = secondBody.messages.find(
      (m: { role: string; _state?: unknown }) =>
        m.role === "assistant" && m._state != null,
    )
    expect(assistantWithState._state).toEqual(START_STATE)

    // And the clicked suggestion is sent as the latest user message.
    expect(secondBody.messages.at(-1)).toMatchObject({
      role: "user",
      content: "Expense",
    })
  })
})
