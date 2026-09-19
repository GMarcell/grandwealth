import { getBudgetMonthKey } from "../budget-months";
import { formatIDR } from "../utils";

// Helper to check budget alert level.
//
// `spentByCategory` must be the total already spent per category for the
// current budget month across ALL matching transactions — not just the page
// currently rendered. Callers pass the server-side aggregate so the alert
// never under-counts when a month spans more than one page of transactions.
export function getBudgetAlert(
  category: string,
  newAmount: number,
  budgets: any[],
  spentByCategory: Map<string, number>,
  startDay: number = 1,
): { level: "near" | "over" | null; message: string } {
  const monthKey = getBudgetMonthKey(new Date(), startDay);

  const budget = budgets?.find(
    (b: any) => b.categoryName === category && b.month === monthKey,
  );
  if (!budget) return { level: null, message: "" };

  // Total spent for this category this budget month INCLUDING the new transaction
  const totalSpent = (spentByCategory.get(category) ?? 0) + newAmount;

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
