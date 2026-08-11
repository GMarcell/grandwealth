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
  date: z.string().min(1).optional(),
})

export const updateTransactionSchema = createTransactionSchema.partial()

// ─── Categories ──────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  type: z.enum(["INCOME", "EXPENSE"], { message: "Type must be INCOME or EXPENSE" }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex color (e.g. #6366f1)").optional(),
  ruleType: z.enum(["NEED", "WANT", "SAVINGS"]).nullable().optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

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
  date: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
})

export const updateGoldSchema = createGoldSchema.partial()

// ─── Stocks ──────────────────────────────────
export const createStockSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(10)
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1, "Name is required").max(200),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be positive"),
  buyPrice: z.number().positive("Buy price must be positive").finite(),
  date: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
})

export const updateStockSchema = createStockSchema.partial()

// ─── Bank Savings ────────────────────────────
export const createBankSavingSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL"], { message: "Type must be DEPOSIT or WITHDRAWAL" }),
  accountName: z.string().min(1, "Account name is required").max(100),
  amount: z.number().positive("Amount must be positive").finite(),
  date: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
})

export const updateBankSavingSchema = createBankSavingSchema.partial()

// ─── Recurring Transactions ──────────────────
export const createRecurringSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1, "Category is required").max(100),
  amount: z.number().positive("Amount must be positive").finite(),
  description: z.string().min(1, "Description is required").max(500),
  frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1).optional().nullable(),
  nextDate: z.string().min(1, "Next date is required"),
  active: z.boolean().optional(),
  // Optional savings goal: each time the recurring fires, the amount is also
  // added to the goal's saved amount (e.g. a monthly "savings transfer").
  savingsGoalId: z.string().optional().nullable(),
})

export const updateRecurringSchema = createRecurringSchema.partial()

// ─── Savings Goals ───────────────────────────────
export const createGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(100),
  targetAmount: z.number().positive("Target amount must be positive").finite(),
  savedAmount: z.number().nonnegative("Saved amount must be >= 0").finite().optional(),
  targetDate: z.string().min(1).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex color (e.g. #6366f1)").optional(),
})

export const updateGoalSchema = createGoalSchema.partial()

export const contributeGoalSchema = z.object({
  // Positive adds to the goal; negative withdraws from it. The handler clamps
  // the resulting balance at zero.
  amount: z.number().finite(),
})

// ─── Loans / Debts ────────────────────────────────
export const createLoanSchema = z.object({
  name: z.string().min(1, "Loan name is required").max(100),
  principal: z.number().positive("Principal must be positive").finite(),
  remainingBalance: z.number().nonnegative("Remaining balance must be >= 0").finite(),
  interestRate: z.number().nonnegative("Interest rate must be >= 0").finite().optional().nullable(),
  monthlyPayment: z.number().positive("Monthly payment must be positive").finite().optional().nullable(),
  startDate: z.string().min(1, "Start date is required"),
  notes: z.string().max(500).optional(),
})

export const updateLoanSchema = createLoanSchema.partial()

export const payLoanSchema = z.object({
  amount: z.number().positive("Payment amount must be positive").finite(),
})

// ─── Dividends ────────────────────────────────────
export const createDividendSchema = z.object({
  stockId: z.string().min(1, "Stock is required"),
  amount: z.number().positive("Dividend amount must be positive").finite(),
  date: z.string().min(1).optional(),
  notes: z.string().max(500).optional(),
})

export const updateDividendSchema = createDividendSchema.partial()

// ─── Password Reset ───────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
})

// ─── Budget Template ──────────────────────────────
export const budgetTemplateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
})

// ─── Form Schemas (for react-hook-form validation) ───
// These use z.string() with .refine() for numeric fields
// since HTML inputs always produce strings.

export const budgetFormSchema = z.object({
  categoryName: z.string().min(1, "Category is required"),
  amount: z.string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be a positive number"),
  rolloverEnabled: z.boolean(),
  rolloverCap: z.string().optional(),
})

export const goldFormSchema = z.object({
  type: z.enum(["BUY", "SELL"], { message: "Type must be BUY or SELL" }),
  weight: z.string()
    .min(1, "Weight is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Weight must be a positive number"),
  price: z.string()
    .min(1, "Price is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Price must be a positive number"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
})

export const recurringFormSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1, "Category is required"),
  amount: z.string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be a positive number"),
  description: z.string().min(1, "Description is required").max(500),
  frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  nextDate: z.string().min(1, "Next date is required"),
  savingsGoalId: z.string().optional(),
})

export const savingsFormSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL"], { message: "Type must be DEPOSIT or WITHDRAWAL" }),
  accountName: z.string().min(1, "Account name is required").max(100),
  amount: z.string().min(1, "Amount is required").refine(
    (v) => !isNaN(Number(v)) && Number(v) > 0,
    "Amount must be a positive number"
  ),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional(),
})

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  type: z.enum(["INCOME", "EXPENSE"], { message: "Type must be INCOME or EXPENSE" }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
})

export const stockFormSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  name: z.string().min(1, "Name is required").max(200),
  quantity: z.string().min(1, "Quantity is required").refine(
    (v) => !isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) > 0,
    "Quantity must be a positive integer"
  ),
  buyPrice: z.string().min(1, "Buy price is required").refine(
    (v) => !isNaN(Number(v)) && Number(v) > 0,
    "Buy price must be a positive number"
  ),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional(),
})

export const goalFormSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(100),
  targetAmount: z.string()
    .min(1, "Target amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Target amount must be a positive number"),
  savedAmount: z.string().optional(),
  targetDate: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
})

export const loanFormSchema = z.object({
  name: z.string().min(1, "Loan name is required").max(100),
  principal: z.string()
    .min(1, "Principal is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Principal must be a positive number"),
  remainingBalance: z.string()
    .min(1, "Remaining balance is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Balance must be zero or positive"),
  interestRate: z.string().optional(),
  monthlyPayment: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  notes: z.string().max(500).optional(),
})

export const dividendFormSchema = z.object({
  stockId: z.string().min(1, "Stock is required"),
  amount: z.string()
    .min(1, "Amount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be a positive number"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional(),
})

export const transactionFormSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"], { message: "Type must be INCOME or EXPENSE" }),
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (v) => !isNaN(Number(v)) && Number(v) > 0,
    "Amount must be a positive number"
  ),
  description: z.string().min(1, "Description is required").max(500),
  date: z.string().min(1, "Date is required"),
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
