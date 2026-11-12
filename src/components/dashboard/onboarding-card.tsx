"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  CircleDollarSign,
  Landmark,
  PiggyBank,
  Sparkles,
  X,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DISMISS_KEY = "grandwealth:onboarding-dismissed"

interface OnboardingCardProps {
  hasTransactions: boolean
  hasBudget: boolean
  hasInvestment: boolean
  hasSavings: boolean
}

/**
 * First-run checklist. Each step is derived from data the dashboard already
 * loads, so it costs no extra requests and ticks itself off as the user adds
 * records. Dismissal is remembered locally, and the card disappears on its own
 * once every step is complete.
 */
export function OnboardingCard({
  hasTransactions,
  hasBudget,
  hasInvestment,
  hasSavings,
}: OnboardingCardProps) {
  // `null` means "not read yet". Starting hidden avoids rendering the card for
  // users who previously dismissed it and then popping it away after mount.
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  const steps = [
    {
      label: "Log your first transaction",
      description: "Add income or an expense to start tracking cash flow.",
      href: "/transactions?add=1",
      icon: ArrowLeftRight,
      done: hasTransactions,
    },
    {
      label: "Set a monthly budget",
      description: "Give each spending category a limit for this month.",
      href: "/budgets",
      icon: PiggyBank,
      done: hasBudget,
    },
    {
      label: "Track an investment",
      description: "Record gold deposits or stock holdings.",
      href: "/gold?add=1",
      icon: CircleDollarSign,
      done: hasInvestment,
    },
    {
      label: "Add a savings account",
      description: "Log deposits so they count toward your net worth.",
      href: "/savings?add=1",
      icon: Landmark,
      done: hasSavings,
    },
  ]

  const completed = steps.filter((step) => step.done).length
  const allDone = completed === steps.length

  if (dismissed !== false || allDone) return null

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // Private mode / storage disabled: just hide it for this session.
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold leading-tight">
                Get started with GrandWealth
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completed} of {steps.length} steps done — a few minutes now and
                your dashboard tells the whole story.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={dismiss}
            aria-label="Dismiss getting-started checklist"
            className="shrink-0 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed}
          aria-label="Getting started progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {steps.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              className={cn(
                "group flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                step.done
                  ? "bg-muted/40 opacity-70"
                  : "hover:border-primary/40 hover:bg-accent/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  step.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-muted-foreground/40 text-muted-foreground",
                )}
              >
                {step.done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <step.icon className="h-3 w-3" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-medium leading-tight",
                    step.done && "line-through",
                  )}
                >
                  {step.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {step.description}
                </span>
              </span>
              {!step.done && (
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
