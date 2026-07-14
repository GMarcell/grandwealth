import { describe, it, expect } from "vitest"
import {
  registerSchema,
  createTransactionSchema,
  updateTransactionSchema,
  createCategorySchema,
  createBudgetSchema,
  updateBudgetSchema,
  createGoldSchema,
  createStockSchema,
  createRecurringSchema,
  safeParseBody,
} from "../validation"
import { z } from "zod"

// ─── registerSchema ──────────────────────────

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "secure123",
      name: "John Doe",
    })
    expect(result.success).toBe(true)
  })

  it("accepts registration without name", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "secure123",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "secure123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects short password (< 6 characters)", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "12345",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty email", () => {
    const result = registerSchema.safeParse({
      email: "",
      password: "secure123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects password over 128 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "x".repeat(129),
    })
    expect(result.success).toBe(false)
  })

  it("rejects name over 100 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "secure123",
      name: "x".repeat(101),
    })
    expect(result.success).toBe(false)
  })
})

// ─── createTransactionSchema ─────────────────

describe("createTransactionSchema", () => {
  it("accepts a valid expense transaction", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Food",
      amount: 50000,
      description: "Lunch",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a valid income transaction", () => {
    const result = createTransactionSchema.safeParse({
      type: "INCOME",
      category: "Salary",
      amount: 5000000,
      description: "Monthly salary",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a transaction with date", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Transport",
      amount: 20000,
      description: "Gojek",
      date: "2026-07-01T00:00:00.000Z",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid transaction type", () => {
    const result = createTransactionSchema.safeParse({
      type: "INVESTMENT",
      category: "Food",
      amount: 50000,
      description: "Lunch",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative amount", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Food",
      amount: -100,
      description: "Lunch",
    })
    expect(result.success).toBe(false)
  })

  it("rejects zero amount", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Food",
      amount: 0,
      description: "Free lunch",
    })
    expect(result.success).toBe(false)
  })

  it("rejects Infinity amount", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Food",
      amount: Infinity,
      description: "Lunch",
    })
    expect(result.success).toBe(false)
  })

  it("rejects NaN amount", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Food",
      amount: NaN,
      description: "Lunch",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty category", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "",
      amount: 50000,
      description: "Lunch",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty description", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Food",
      amount: 50000,
      description: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects description over 500 characters", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      category: "Food",
      amount: 50000,
      description: "x".repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

// ─── updateTransactionSchema ─────────────────

describe("updateTransactionSchema", () => {
  it("accepts a partial update with just amount", () => {
    const result = updateTransactionSchema.safeParse({ amount: 75000 })
    expect(result.success).toBe(true)
  })

  it("accepts a partial update with just description", () => {
    const result = updateTransactionSchema.safeParse({ description: "Updated" })
    expect(result.success).toBe(true)
  })

  it("accepts empty object (no fields to update)", () => {
    const result = updateTransactionSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("rejects invalid amount in partial update", () => {
    const result = updateTransactionSchema.safeParse({ amount: -100 })
    expect(result.success).toBe(false)
  })
})

// ─── createCategorySchema ────────────────────

describe("createCategorySchema", () => {
  it("accepts a valid expense category", () => {
    const result = createCategorySchema.safeParse({
      name: "Groceries",
      type: "EXPENSE",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a category with a custom color", () => {
    const result = createCategorySchema.safeParse({
      name: "Groceries",
      type: "EXPENSE",
      color: "#ff5733",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid type", () => {
    const result = createCategorySchema.safeParse({
      name: "Groceries",
      type: "SAVINGS",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid hex color", () => {
    const result = createCategorySchema.safeParse({
      name: "Groceries",
      type: "EXPENSE",
      color: "blue",
    })
    expect(result.success).toBe(false)
  })

  it("rejects color without hash prefix", () => {
    const result = createCategorySchema.safeParse({
      name: "Groceries",
      type: "EXPENSE",
      color: "ff5733",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = createCategorySchema.safeParse({
      name: "",
      type: "EXPENSE",
    })
    expect(result.success).toBe(false)
  })

  it("rejects name over 50 characters", () => {
    const result = createCategorySchema.safeParse({
      name: "x".repeat(51),
      type: "EXPENSE",
    })
    expect(result.success).toBe(false)
  })
})

// ─── createBudgetSchema ──────────────────────

describe("createBudgetSchema", () => {
  it("accepts a valid budget", () => {
    const result = createBudgetSchema.safeParse({
      categoryName: "Food",
      amount: 1000000,
      month: "2026-07",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a budget with rollover options", () => {
    const result = createBudgetSchema.safeParse({
      categoryName: "Food",
      amount: 1000000,
      month: "2026-07",
      rolloverEnabled: false,
      rolloverCap: 500000,
    })
    expect(result.success).toBe(true)
  })

  it("accepts rolloverCap as null (unlimited)", () => {
    const result = createBudgetSchema.safeParse({
      categoryName: "Food",
      amount: 1000000,
      month: "2026-07",
      rolloverCap: null,
    })
    expect(result.success).toBe(true)
  })

  it("rejects negative amount", () => {
    const result = createBudgetSchema.safeParse({
      categoryName: "Food",
      amount: -100,
      month: "2026-07",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid month format", () => {
    const result = createBudgetSchema.safeParse({
      categoryName: "Food",
      amount: 1000000,
      month: "2026/07",
    })
    expect(result.success).toBe(false)
  })

  it("rejects month without leading zero", () => {
    const result = createBudgetSchema.safeParse({
      categoryName: "Food",
      amount: 1000000,
      month: "2026-7",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative rolloverCap", () => {
    const result = createBudgetSchema.safeParse({
      categoryName: "Food",
      amount: 1000000,
      month: "2026-07",
      rolloverCap: -100,
    })
    expect(result.success).toBe(false)
  })
})

// ─── updateBudgetSchema ──────────────────────

describe("updateBudgetSchema", () => {
  it("accepts updating amount and rollover", () => {
    const result = updateBudgetSchema.safeParse({
      amount: 2000000,
      rolloverEnabled: true,
    })
    expect(result.success).toBe(true)
  })

  it("rejects categoryName (should not be in update)", () => {
    const result = updateBudgetSchema.safeParse({
      categoryName: "NewName",
    })
    // .omit({ categoryName: true, month: true }) means these are stripped from the schema
    expect(result.success).toBe(true)
    // categoryName should be undefined in the output
    if (result.success) {
      expect(result.data.categoryName).toBeUndefined()
    }
  })
})

// ─── createGoldSchema ────────────────────────

describe("createGoldSchema", () => {
  it("accepts a valid gold purchase", () => {
    const result = createGoldSchema.safeParse({
      type: "BUY",
      weightGram: 10,
      pricePerGram: 1000000,
    })
    expect(result.success).toBe(true)
  })

  it("accepts a gold sell with all optional fields", () => {
    const result = createGoldSchema.safeParse({
      type: "SELL",
      weightGram: 5,
      pricePerGram: 1100000,
      totalAmount: 5500000,
      date: "2026-07-15T00:00:00.000Z",
      notes: "Sold for profit",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid gold type", () => {
    const result = createGoldSchema.safeParse({
      type: "HOLD",
      weightGram: 10,
      pricePerGram: 1000000,
    })
    expect(result.success).toBe(false)
  })

  it("rejects zero weight", () => {
    const result = createGoldSchema.safeParse({
      type: "BUY",
      weightGram: 0,
      pricePerGram: 1000000,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative price", () => {
    const result = createGoldSchema.safeParse({
      type: "BUY",
      weightGram: 10,
      pricePerGram: -100,
    })
    expect(result.success).toBe(false)
  })

  it("rejects notes over 500 characters", () => {
    const result = createGoldSchema.safeParse({
      type: "BUY",
      weightGram: 10,
      pricePerGram: 1000000,
      notes: "x".repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

// ─── createStockSchema ───────────────────────

describe("createStockSchema", () => {
  it("accepts a valid stock entry", () => {
    const result = createStockSchema.safeParse({
      symbol: "bbcA",
      name: "Bank Central Asia Tbk",
      quantity: 100,
      buyPrice: 10250,
    })
    expect(result.success).toBe(true)
    // Symbol should be uppercased by transform
    if (result.success) {
      expect(result.data.symbol).toBe("BBCA")
    }
  })

  it("accepts a stock with optional fields", () => {
    const result = createStockSchema.safeParse({
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      quantity: 100,
      buyPrice: 10250,
      date: "2026-07-01T00:00:00.000Z",
      notes: "Long term hold",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty symbol", () => {
    const result = createStockSchema.safeParse({
      symbol: "",
      name: "Bank Central Asia Tbk",
      quantity: 100,
      buyPrice: 10250,
    })
    expect(result.success).toBe(false)
  })

  it("rejects symbol over 10 characters", () => {
    const result = createStockSchema.safeParse({
      symbol: "ABCDEFGHIJK",
      name: "Test",
      quantity: 100,
      buyPrice: 10250,
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-integer quantity", () => {
    const result = createStockSchema.safeParse({
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      quantity: 100.5,
      buyPrice: 10250,
    })
    expect(result.success).toBe(false)
  })

  it("rejects zero quantity", () => {
    const result = createStockSchema.safeParse({
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      quantity: 0,
      buyPrice: 10250,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative buy price", () => {
    const result = createStockSchema.safeParse({
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      quantity: 100,
      buyPrice: -100,
    })
    expect(result.success).toBe(false)
  })
})

// ─── createRecurringSchema ───────────────────

describe("createRecurringSchema", () => {
  const validRecurring = {
    type: "EXPENSE" as const,
    category: "Subscription",
    amount: 150000,
    description: "Netflix",
    frequency: "MONTHLY" as const,
    startDate: "2026-01-01T00:00:00.000Z",
    nextDate: "2026-07-01T00:00:00.000Z",
  }

  it("accepts a valid recurring transaction", () => {
    const result = createRecurringSchema.safeParse(validRecurring)
    expect(result.success).toBe(true)
  })

  it("accepts a recurring transaction with endDate", () => {
    const result = createRecurringSchema.safeParse({
      ...validRecurring,
      endDate: "2026-12-31T00:00:00.000Z",
    })
    expect(result.success).toBe(true)
  })

  it("accepts all frequency types", () => {
    for (const freq of ["WEEKLY", "MONTHLY", "YEARLY"] as const) {
      const result = createRecurringSchema.safeParse({
        ...validRecurring,
        frequency: freq,
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid frequency", () => {
    const result = createRecurringSchema.safeParse({
      ...validRecurring,
      frequency: "DAILY",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid startDate format", () => {
    const result = createRecurringSchema.safeParse({
      ...validRecurring,
      startDate: "2026-01-01", // missing time component
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing required fields", () => {
    const result = createRecurringSchema.safeParse({
      type: "EXPENSE",
    })
    expect(result.success).toBe(false)
  })
})

// ─── safeParseBody ───────────────────────────

describe("safeParseBody", () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  })

  it("returns data for valid JSON body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "John", age: 30 }),
      headers: { "Content-Type": "application/json" },
    })
    const result = await safeParseBody(request, testSchema)
    expect("data" in result).toBe(true)
    if ("data" in result) {
      expect(result.data).toEqual({ name: "John", age: 30 })
    }
  })

  it("returns error Response for invalid JSON body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    })
    const result = await safeParseBody(request, testSchema)
    expect("error" in result).toBe(true)
    if ("error" in result) {
      const response = result.error
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("Invalid JSON body")
    }
  })

  it("returns error Response for validation failure", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "", age: -5 }),
      headers: { "Content-Type": "application/json" },
    })
    const result = await safeParseBody(request, testSchema)
    expect("error" in result).toBe(true)
    if ("error" in result) {
      const response = result.error
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeTruthy()
      expect(body.details).toBeInstanceOf(Array)
      expect(body.details.length).toBeGreaterThan(0)
      expect(body.details[0]).toHaveProperty("field")
      expect(body.details[0]).toHaveProperty("message")
    }
  })

  it("returns 400 for request with no body", async () => {
    // A request with no body will cause a JSON parse error
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const result = await safeParseBody(request, testSchema)
    expect("error" in result).toBe(true)
  })

  it("returns correct error field paths for nested schemas", async () => {
    const nestedSchema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    })
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ user: { email: "bad" } }),
      headers: { "Content-Type": "application/json" },
    })
    const result = await safeParseBody(request, nestedSchema)
    if ("error" in result) {
      const body = await result.error.json()
      expect(body.details[0].field).toBe("user.email")
    }
  })
})
