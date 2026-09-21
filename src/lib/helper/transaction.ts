import { formatIDR } from "../utils";

// Helper to check budget alert level.
//
// `effectiveBudget` must be the carry-over-ADJUSTED limit for the category in
// the current budget month (budget amount + rollover received), not the raw
// budget amount — otherwise the alert disagrees with the budgets page and
// dashboard when unused budget rolled over. Pass `undefined` when the category
// has no budget this month.
//
// `spentByCategory` must be the total already spent per category for the
// current budget month across ALL matching transactions — not just the page
// currently rendered. Callers pass the server-side aggregate so the alert
// never under-counts when a month spans more than one page of transactions.
export function getBudgetAlert(
  category: string,
  newAmount: number,
  effectiveBudget: number | undefined,
  spentByCategory: Map<string, number>,
): { level: "near" | "over" | null; message: string } {
  if (effectiveBudget == null || effectiveBudget <= 0) {
    return { level: null, message: "" };
  }

  // Total spent for this category this budget month INCLUDING the new transaction
  const totalSpent = (spentByCategory.get(category) ?? 0) + newAmount;

  const percentUsed = (totalSpent / effectiveBudget) * 100;
  const remaining = effectiveBudget - totalSpent;

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
