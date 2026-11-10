import { z } from "zod"
import { budgetFormSchema } from "@/lib/validation"

export const RULE_TYPE_LABEL: Record<"NEED" | "WANT" | "SAVINGS", string> = {
  NEED: "Need",
  WANT: "Want",
  SAVINGS: "Savings",
};

export const EXPENSE_CATEGORIES = [
  "FOOD",
  "TRANSPORTATION",
  "HOUSING",
  "UTILITIES",
  "HEALTHCARE",
  "EDUCATION",
  "ENTERTAINMENT",
  "SHOPPING",
  "TRAVEL",
  "INSURANCE",
  "TAX",
  "SUBSCRIPTION",
  "OTHER_EXPENSE",
] as const;

export interface Budget {
  id: string;
  categoryName: string;
  amount: number;
  month: string;
  rolloverCap: number | null;
  canReduce: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

export type BudgetFormData = z.infer<typeof budgetFormSchema>;

export type BudgetPayload = {
  categoryName: string;
  amount: number;
  month: string;
  rolloverCap: number | null;
  canReduce?: boolean;
};

/** Spend per budget month → category, from `/api/budgets/spent-by-month`. */
export type SpentByMonth = {
  startDay: number;
  spentByMonthCategory: Record<string, Record<string, number>>;
};

export type RolloverMonth = { key: string; label: string };
export type RolloverMonthEntry = {
  month: string;
  rolloverReceived: number;
  carryOverEnabled: boolean;
  unused: number;
};
export type RolloverCategory = {
  categoryName: string;
  months: RolloverMonthEntry[];
};
export type RolloverHistory = {
  months: RolloverMonth[];
  categories: RolloverCategory[];
};

export type PlanBudget = {
  categoryName: string;
  amount: number;
  ruleType: "NEED" | "WANT" | "SAVINGS";
  spent: number;
};
export type BudgetPlan = {
  month: string;
  sourceMonth: string;
  incomeMonth: string;
  summary: string;
  income: number;
  totalExpenses: number;
  totalBudgeted: number;
  budgets: PlanBudget[];
  skippedGroups: Array<"NEED" | "WANT" | "SAVINGS">;
};

// Admin-only AI plan shape (Groq).
export type AiPlanBudget = {
  categoryName: string;
  amount: number;
  reason: string | null;
};
export type AiPlan = {
  month: string;
  sourceMonth: string;
  summary: string;
  totalIncome: number;
  totalExpenses: number;
  totalBudgeted: number;
  budgets: AiPlanBudget[];
};
