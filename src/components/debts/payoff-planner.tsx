"use client"

import { useState } from "react"
import { addMonths, format } from "date-fns"
import { Calculator, Info, TrendingDown } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatCompactIDR, formatIDR } from "@/lib/utils"

/** Safety cap so a payment that barely covers interest cannot loop forever. */
const MAX_MONTHS = 1200

export interface PayoffLoan {
  id: string
  name: string
  remainingBalance: number
  interestRate: number | null
  monthlyPayment: number | null
}

interface Simulation {
  months: number
  totalInterest: number
  neverPaysOff: boolean
}

/**
 * Straight-line amortization simulation: interest accrues on the remaining
 * balance each month, then the payment is applied. Extra money is added to the
 * regular payment every month.
 */
function simulate(
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number,
): Simulation {
  const monthlyRate = annualRatePercent / 100 / 12
  if (balance <= 0) return { months: 0, totalInterest: 0, neverPaysOff: false }
  if (monthlyPayment <= 0) {
    return { months: MAX_MONTHS, totalInterest: 0, neverPaysOff: true }
  }
  // A payment that does not cover the first month's interest can never reduce
  // the principal.
  if (monthlyPayment <= balance * monthlyRate) {
    return { months: MAX_MONTHS, totalInterest: 0, neverPaysOff: true }
  }

  let remaining = balance
  let totalInterest = 0
  let months = 0

  while (remaining > 0 && months < MAX_MONTHS) {
    const interest = remaining * monthlyRate
    totalInterest += interest
    remaining = remaining + interest - monthlyPayment
    months += 1
  }

  return { months, totalInterest, neverPaysOff: remaining > 0 }
}

function formatMonths(months: number): string {
  if (months <= 0) return "0 mo"
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} mo`
  return rest === 0 ? `${years}y` : `${years}y ${rest}m`
}

function payoffDateLabel(months: number): string {
  return format(addMonths(new Date(), months), "MMM yyyy")
}

interface PayoffPlannerProps {
  loans: PayoffLoan[]
}

export function PayoffPlanner({ loans }: PayoffPlannerProps) {
  const [selectedId, setSelectedId] = useState("")
  const [extraInput, setExtraInput] = useState("")

  const activeLoans = loans.filter((loan) => loan.remainingBalance > 0)
  const selected =
    activeLoans.find((loan) => loan.id === selectedId) ?? activeLoans[0]

  if (!selected) return null

  const extra = Math.max(0, parseFloat(extraInput) || 0)
  const monthlyPayment = selected.monthlyPayment ?? 0
  const hasPayment = monthlyPayment > 0
  const annualRate = selected.interestRate ?? 0

  const baseline = hasPayment
    ? simulate(selected.remainingBalance, annualRate, monthlyPayment)
    : null
  const withExtra = hasPayment
    ? simulate(selected.remainingBalance, annualRate, monthlyPayment + extra)
    : null

  const monthsSaved =
    baseline && withExtra && !baseline.neverPaysOff && !withExtra.neverPaysOff
      ? baseline.months - withExtra.months
      : 0
  const interestSaved =
    baseline && withExtra && !baseline.neverPaysOff && !withExtra.neverPaysOff
      ? Math.max(0, baseline.totalInterest - withExtra.totalInterest)
      : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          Payoff Planner
        </CardTitle>
        <CardDescription>
          See how much time and interest an extra monthly payment could save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payoffLoan">Loan</Label>
            <Select
              value={selected.id}
              onValueChange={(value) => setSelectedId(value)}
            >
              <SelectTrigger id="payoffLoan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeLoans.map((loan) => (
                  <SelectItem key={loan.id} value={loan.id}>
                    {loan.name} — {formatCompactIDR(loan.remainingBalance)} left
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extraPayment">Extra payment per month (Rp)</Label>
            <Input
              id="extraPayment"
              type="number"
              min="0"
              step="50000"
              inputMode="numeric"
              placeholder="e.g. 500000"
              value={extraInput}
              onChange={(event) => setExtraInput(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Added on top of the recorded{" "}
              {hasPayment ? formatIDR(monthlyPayment) : "—"} monthly payment.
            </p>
          </div>
        </div>

        {!hasPayment || !baseline || !withExtra ? (
          <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This loan has no monthly payment recorded, so it can&apos;t be
              simulated yet. Edit the loan and add a monthly payment to see a
              payoff plan.
            </p>
          </div>
        ) : (
          <div aria-live="polite" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Current plan
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {baseline.neverPaysOff
                    ? "Never"
                    : formatMonths(baseline.months)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {baseline.neverPaysOff
                    ? "The monthly payment does not cover the interest."
                    : `${formatIDR(baseline.totalInterest)} interest · debt-free ${payoffDateLabel(baseline.months)}`}
                </p>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-3",
                  extra > 0 && "border-primary/40 bg-primary/[0.03]",
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {extra > 0
                    ? `With ${formatIDR(extra)} extra/mo`
                    : "With an extra payment"}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {withExtra.neverPaysOff
                    ? "Never"
                    : formatMonths(withExtra.months)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {withExtra.neverPaysOff
                    ? "Still too low to reduce the principal."
                    : `${formatIDR(withExtra.totalInterest)} interest · debt-free ${payoffDateLabel(withExtra.months)}`}
                </p>
              </div>
            </div>

            {extra > 0 && baseline.neverPaysOff && !withExtra.neverPaysOff && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="profit" className="gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Turns an endless balance into a payoff plan
                </Badge>
              </div>
            )}

            {extra > 0 && !baseline.neverPaysOff && monthsSaved > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="profit" className="gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {formatMonths(monthsSaved)} sooner
                </Badge>
                <Badge variant="profit">
                  {formatIDR(interestSaved)} less interest
                </Badge>
              </div>
            )}

            {extra > 0 &&
              !baseline.neverPaysOff &&
              !withExtra.neverPaysOff &&
              monthsSaved === 0 && (
                <p className="text-xs text-muted-foreground">
                  This extra amount does not shorten the current plan.
                </p>
              )}

            {extra > 0 && withExtra.neverPaysOff && (
              <p className="text-xs text-muted-foreground">
                Increase the extra payment so the total clears the monthly
                interest before the balance can go down.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
