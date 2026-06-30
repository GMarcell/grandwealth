"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import {
  LayoutDashboard,
  ArrowLeftRight,
  CircleDollarSign,
  TrendingUp,
  Settings,
  LogOut,
  Wallet,
  Sun,
  Moon,
  Monitor,
  Check,
  X,
  PiggyBank,
  Repeat,
  BarChart3,
} from "lucide-react"
import { useTheme } from "next-themes"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/gold", label: "Gold", icon: CircleDollarSign },
  { href: "/stocks", label: "Stocks", icon: TrendingUp },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  isMobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()

  // Fetch budget alert count for sidebar badge
  const { data: dashboardData } = useQuery<any>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 120_000,
  })

  const overBudgetCount = dashboardData?.budgetSummary?.overBudget ?? 0

  const renderNavItems = (onClick?: () => void) =>
    navItems.map((item) => {
      const isActive = pathname.startsWith(item.href)
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span className="flex-1">{item.label}</span>
          {item.href === "/budgets" && overBudgetCount > 0 && (
            <Badge variant="loss" className="h-5 min-w-5 px-1 text-[10px] flex items-center justify-center">
              {overBudgetCount}
            </Badge>
          )}
        </Link>
      )
    })

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden touch-none"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 max-w-[calc(100vw-3rem)] flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:z-40",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + Close button */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-sidebar-primary" />
            <span className="text-lg font-bold tracking-tight">GrandWealth</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMobileClose}
            className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground min-w-[44px] min-h-[44px]"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {renderNavItems(onMobileClose)}
        </nav>

        {/* User & Theme */}
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
              {session?.user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session?.user?.name || "User"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {session?.user?.email || ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-36">
                <DropdownMenuItem onClick={() => setTheme("light")} className="gap-3">
                  <Sun className="h-4 w-4" />
                  Light
                  {theme === "light" && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-3">
                  <Moon className="h-4 w-4" />
                  Dark
                  {theme === "dark" && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} className="gap-3">
                  <Monitor className="h-4 w-4" />
                  System
                  {theme === "system" && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => signOut()}
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground ml-auto"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
