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
