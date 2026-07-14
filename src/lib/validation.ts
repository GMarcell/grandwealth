import { z } from "zod"

// ─── Auth ────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
})

// ─── Transactions ────────────────────────────
export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"], { message: "Type must be INCOME or EXPENSE" }),
  category: z.string().min(1, "Category is required").max(100),
  amount: z.number().positive("Amount must be positive").finite(),
  description: z.string().min(1, "Description is required").max(500),
  date: z.string().optional(),
})

export const updateTransactionSchema = createTransactionSchema.partial()

// ─── Categories ──────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  type: z.enum(["INCOME", "EXPENSE"], { message: "Type must be INCOME or EXPENSE" }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex color (e.g. #6366f1)").optional(),
})

// ─── Budgets ─────────────────────────────────
export const createBudgetSchema = z.object({
  categoryName: z.string().min(1, "Category is required").max(100),
  amount: z.number().positive("Budget amount must be greater than 0").finite(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  rolloverEnabled: z.boolean().optional(),
  rolloverCap: z.number().nonnegative("Rollover cap must be >= 0").finite().nullable().optional(),
})

export const updateBudgetSchema = createBudgetSchema.partial().omit({ categoryName: true, month: true })

// ─── Gold ────────────────────────────────────
export const createGoldSchema = z.object({
  type: z.enum(["BUY", "SELL"], { message: "Type must be BUY or SELL" }),
  weightGram: z.number().positive("Weight must be positive").finite(),
  pricePerGram: z.number().positive("Price must be positive").finite(),
  totalAmount: z.number().nonnegative().optional(),
  date: z.string().optional(),
  notes: z.string().max(500).optional(),
})

// ─── Stocks ──────────────────────────────────
export const createStockSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(10)
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1, "Name is required").max(200),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be positive"),
  buyPrice: z.number().positive("Buy price must be positive").finite(),
  date: z.string().optional(),
  notes: z.string().max(500).optional(),
})

// ─── Recurring Transactions ──────────────────
export const createRecurringSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1, "Category is required").max(100),
  amount: z.number().positive("Amount must be positive").finite(),
  description: z.string().min(1, "Description is required").max(500),
  frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  nextDate: z.string().datetime(),
})

// ─── Helpers ─────────────────────────────────

/**
 * Safely parse JSON from a request body.
 * Returns either the parsed JSON or a 400 Response.
 */
export async function safeParseBody<T>(request: Request, schema: z.ZodType<T>): Promise<{ data: T } | { error: Response }> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      const firstIssue = result.error.issues[0]
      return {
        error: Response.json(
          {
            error: firstIssue?.message ?? "Validation failed",
            details: result.error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      }
    }

    return { data: result.data }
  } catch {
    return {
      error: Response.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    }
  }
}
