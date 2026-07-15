/**
 * Shared chart color palette used across dashboard, budgets, and reports pages.
 * Order is optimized for visual distinction across categories.
 */
export const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#a855f7", // purple
  "#e11d48", // rose
  "#0ea5e9", // sky
  "#6366f1", // indigo
] as const

/** Subset used by the dashboard wealth breakdown pie chart (5 colors). */
export const CHART_COLORS_DASHBOARD = CHART_COLORS.slice(0, 5)

/**
 * Accent colors for the 50/30/20 budget rule type system.
 * Shared between the settings/transactions pages and the dashboard.
 */
export const RULE_TYPE_ACCENT_NEED = "#3b82f6"
export const RULE_TYPE_ACCENT_WANT = "#f59e0b"
export const RULE_TYPE_ACCENT_SAVINGS = "#10b981"
export const RULE_TYPE_ACCENT_OTHER = "#6b7280"

/**
 * Semantic chart colors for income/expense indicators.
 * Used for line/stroke and bar fill colors in dashboard and reports charts.
 */
export const SEMANTIC_COLOR_INCOME = "#10b981"
export const SEMANTIC_COLOR_EXPENSE = "#ef4444"

/** Map of rule type to its accent color. */
export const RULE_TYPE_ACCENT_COLORS: Record<string, string> = {
  NEED: RULE_TYPE_ACCENT_NEED,
  WANT: RULE_TYPE_ACCENT_WANT,
  SAVINGS: RULE_TYPE_ACCENT_SAVINGS,
  OTHER: RULE_TYPE_ACCENT_OTHER,
}
