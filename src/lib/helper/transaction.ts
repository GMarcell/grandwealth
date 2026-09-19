import { getBudgetMonthKey, getBudgetMonthRange } from "../budget-months";
import { formatIDR } from "../utils";

// Helper to check budget alert level
export function getBudgetAlert(
  category: string,
  newAmount: number,
  budgets: any[],
  transactions: any[],
  startDay: number = 1,
): { level: "near" | "over" | null; message: string } {
  const monthKey = getBudgetMonthKey(new Date(), startDay);

  const budget = budgets?.find(
    (b: any) => b.categoryName === category && b.month === monthKey,
  );
  if (!budget) return { level: null, message: "" };

  // Calculate total spent for this category this budget month INCLUDING the new transaction
  const { start, end } = getBudgetMonthRange(monthKey, startDay);

  let totalSpent = newAmount; // include the new transaction
  for (const tx of transactions ?? []) {
    if (tx.type !== "EXPENSE" || tx.category !== category) continue;
    const txDate = new Date(tx.date);
    if (txDate >= start && txDate <= end) {
      totalSpent += tx.amount;
    }
  }

  const percentUsed = (totalSpent / budget.amount) * 100;
  const remaining = budget.amount - totalSpent;

  if (percentUsed > 100) {
    return {
      level: "over",
      message: `${category.replace("_", " ")} budget exceeded! ${formatIDR(Math.abs(remaining))} over budget (${Math.round(percentUsed)}% used)`,
    };
  }
  if (percentUsed >= 80) {
    return {
      level: "near",
      message: `${category.replace("_", " ")} nearing budget limit: ${formatIDR(remaining)} remaining (${Math.round(percentUsed)}% used)`,
    };
  }

  return { level: null, message: "" };
}
