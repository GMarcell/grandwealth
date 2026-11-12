import type { LucideIcon } from "lucide-react"
import {
  ArrowLeftRight,
  BarChart3,
  Brain,
  CircleDollarSign,
  CreditCard,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * Primary dashboard navigation. Shared by the sidebar and the command palette
 * so a new page only has to be registered once.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/analysis", label: "AI Analysis", icon: Brain },
  { href: "/savings", label: "Savings", icon: Landmark },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/gold", label: "Gold", icon: CircleDollarSign },
  { href: "/stocks", label: "Stocks", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
]
