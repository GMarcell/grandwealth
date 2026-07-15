import {
  RULE_TYPE_ACCENT_NEED,
  RULE_TYPE_ACCENT_WANT,
  RULE_TYPE_ACCENT_SAVINGS,
  RULE_TYPE_ACCENT_OTHER,
} from "@/lib/chart-colors"

/**
 * Shared rule type constants for the 50/30/20 budget rule system.
 * Used across settings page, transactions page, and API routes.
 */

export const RULE_TYPES = ["NEED", "WANT", "SAVINGS"] as const
export type RuleType = (typeof RULE_TYPES)[number]

export const RULE_TYPE_ORDER: RuleType[] = ["NEED", "WANT", "SAVINGS"]

export function isValidRuleType(value: string | null | undefined): value is RuleType {
  return value != null && RULE_TYPES.includes(value as RuleType)
}

export interface RuleTypeConfig {
  label: string
  color: string
  accentColor: string
}

export const RULE_TYPE_CONFIGS: Record<string, RuleTypeConfig> = {
  NEED: {
    label: "Need",
    color: "text-blue-600 dark:text-blue-400",
    accentColor: RULE_TYPE_ACCENT_NEED,
  },
  WANT: {
    label: "Want",
    color: "text-amber-600 dark:text-amber-400",
    accentColor: RULE_TYPE_ACCENT_WANT,
  },
  SAVINGS: {
    label: "Savings",
    color: "text-emerald-600 dark:text-emerald-400",
    accentColor: RULE_TYPE_ACCENT_SAVINGS,
  },
}

export const OTHER_CONFIG: RuleTypeConfig = {
  label: "Other",
  color: "text-gray-500 dark:text-gray-400",
  accentColor: RULE_TYPE_ACCENT_OTHER,
}
