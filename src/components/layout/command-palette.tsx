"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  CircleDollarSign,
  Landmark,
  Moon,
  PiggyBank,
  Plus,
  Shield,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { NAV_ITEMS, type NavItem } from "@/lib/navigation"

interface QuickAction extends NavItem {
  /** Extra query string appended to `href`, e.g. "?add=1". */
  query?: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: "/transactions",
    query: "?add=1&type=EXPENSE",
    label: "Add expense",
    icon: TrendingDown,
  },
  {
    href: "/transactions",
    query: "?add=1&type=INCOME",
    label: "Add income",
    icon: TrendingUp,
  },
  {
    href: "/transactions",
    query: "?add=1",
    label: "Add transaction",
    icon: Plus,
  },
  {
    href: "/gold",
    query: "?add=1",
    label: "Record gold deposit",
    icon: CircleDollarSign,
  },
  {
    href: "/stocks",
    query: "?add=1",
    label: "Add stock holding",
    icon: TrendingUp,
  },
  {
    href: "/savings",
    query: "?add=1",
    label: "Record savings deposit",
    icon: Landmark,
  },
  {
    href: "/budgets",
    label: "Set monthly budgets",
    icon: PiggyBank,
  },
  {
    href: "/goals",
    label: "Create a savings goal",
    icon: Target,
  },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()

  // ⌘K / Ctrl+K toggles the palette from anywhere in the dashboard.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  const pages: NavItem[] =
    session?.user?.role === "ADMIN"
      ? [...NAV_ITEMS, { href: "/admin", label: "Admin", icon: Shield }]
      : NAV_ITEMS

  function run(href: string) {
    onOpenChange(false)
    const path = href.split("?")[0]
    // The quick-add pages open their dialog from a mount effect that reads
    // window.location, so navigating to the same page with a new query string
    // does not re-run it. A full navigation there is the reliable option; all
    // other jumps stay client-side.
    if (window.location.pathname === path && href.includes("?")) {
      window.location.assign(href)
      return
    }
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 [&>button]:hidden sm:max-w-xl"
        // The input's own border is the only divider we want.
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command loop>
          <CommandInput placeholder="Search pages and actions…" autoFocus />
          <CommandList className="max-h-[min(60vh,420px)]">
            <CommandEmpty>No matching pages or actions.</CommandEmpty>

            <CommandGroup heading="Quick actions">
              {QUICK_ACTIONS.map((action) => (
                <CommandItem
                  key={action.label}
                  value={action.label}
                  onSelect={() => run(`${action.href}${action.query ?? ""}`)}
                >
                  <action.icon className="text-muted-foreground" />
                  <span>{action.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Pages">
              {pages.map((page) => (
                <CommandItem
                  key={page.href}
                  value={page.label}
                  onSelect={() => run(page.href)}
                >
                  <page.icon className="text-muted-foreground" />
                  <span>{page.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Appearance">
              <CommandItem
                value="toggle theme dark light"
                onSelect={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  onOpenChange(false)
                }}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="text-muted-foreground" />
                ) : (
                  <Moon className="text-muted-foreground" />
                )}
                <span>
                  Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border px-1">↑</kbd>{" "}
              <kbd className="rounded border px-1">↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded border px-1">↵</kbd> select
            </span>
            <span>
              <kbd className="rounded border px-1">esc</kbd> close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
