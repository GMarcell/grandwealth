import { transactionFormSchema } from "@/lib/validation";
import z from "zod";

export interface TransactionInterface {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}

export type TransactionFormData = z.infer<typeof transactionFormSchema>;

/**
 * Aggregate totals for the current transaction filters, computed across every
 * matching transaction (not just the current page).
 */
export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  /** Total spent per category across the filtered set (opt-in via summaryByCategory=1). */
  byCategory?: Record<string, number>;
}
