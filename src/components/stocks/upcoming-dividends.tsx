"use client"

import { useQuery } from "@tanstack/react-query"
import { CalendarClock, Info, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCompactIDR, formatDate, formatIDR } from "@/lib/utils"

export interface ProjectedDividend {
  symbol: string
  name: string
  stockId: string
  lots: number
  shares: number
  currency: string
  frequency: string
  estimatedNextExDate: string | null
  lastDividendPerShare: number | null
  lastDividendDate: string | null
  trailingDividendPerShare: number | null
  dividendYield: number | null
  estimatedNextPayout: number | null
  estimatedAnnualIncome: number | null
  yieldOnCost: number | null
  history: { date: string; amountPerShare: number }[]
}

interface DividendCalendarPayment {
  symbol: string
  name: string
  lots: number
  shares: number
  amount: number
  estimatedExDate: string
  estimatedPayDate: string
}

interface DividendCalendarMonth {
  month: string
  total: number
  payments: DividendCalendarPayment[]
}

interface DividendCalendar {
  months: DividendCalendarMonth[]
  total: number
  paymentsCount: number
}

interface UpcomingDividendsResponse {
  data: ProjectedDividend[]
  calendar: DividendCalendar
  totals: {
    estimatedNextPayout: number
    estimatedAnnualIncome: number
    holdingsWithDividends: number
    holdingsWithoutData: number
  }
  fetchedAt: string
}

const FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  SEMIANNUAL: "twice a year",
  ANNUAL: "yearly",
  IRREGULAR: "irregular",
  UNKNOWN: "cadence unknown",
}

/** Format a per-share amount without dropping the decimals small payouts have. */
function formatPerShare(value: number): string {
  return `Rp${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`
}

/** "2026-11" → "Nov 26". Pinned to UTC so the month never shifts by timezone. */
function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
}

export function UpcomingDividends({
  onRecord,
}: {
  onRecord: (projection: ProjectedDividend) => void
}) {
  const { data, isLoading, isFetching, isError, refetch } = useQuery<UpcomingDividendsResponse>({
    queryKey: ["dividends-upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/dividends/upcoming")
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Failed to fetch expected dividends")
      }
      return res.json()
    },
    // Dividend schedules move a few times a year at most — no need to hit
    // Yahoo on every visit to the page.
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  })

  const projections = data?.data ?? []
  const totals = data?.totals
  const calendar = data?.calendar
  const maxMonthTotal = calendar
    ? Math.max(0, ...calendar.months.map((m) => m.total))
    : 0

  return (
    <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-emerald-500 shrink-0" />
            Expected dividends
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totals && totals.holdingsWithDividends > 0
              ? `≈ ${formatIDR(totals.estimatedAnnualIncome)} per year across ${totals.holdingsWithDividends} holding${totals.holdingsWithDividends === 1 ? "" : "s"}`
              : "Projected from dividend history on Yahoo Finance"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh expected dividends"
          title="Refresh from Yahoo Finance"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load dividend data. Yahoo Finance may be unavailable.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Try again
          </Button>
        </div>
      ) : projections.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {totals && totals.holdingsWithoutData > 0
            ? "Yahoo Finance has no dividend history for your holdings — they may not pay dividends."
            : "Add stocks to see when their dividends are expected."}
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {projections.map((p) => (
              <li key={p.symbol} className="rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{p.symbol}</span>
                      <Badge variant="outline" className="text-[10px] font-normal px-2 py-0">
                        {FREQUENCY_LABEL[p.frequency] ?? p.frequency.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {p.estimatedNextPayout != null
                        ? `≈ ${formatIDR(p.estimatedNextPayout)}`
                        : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.estimatedNextExDate
                        ? `est. ex-div ${formatDate(p.estimatedNextExDate)}`
                        : "next date unknown"}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {p.shares.toLocaleString("id-ID")} shares ({p.lots} lot)
                  </span>
                  {p.lastDividendPerShare != null && (
                    <span>
                      last {formatPerShare(p.lastDividendPerShare)}/share
                      {p.lastDividendDate ? ` on ${formatDate(p.lastDividendDate)}` : ""}
                    </span>
                  )}
                  {p.estimatedAnnualIncome != null && (
                    <span>≈ {formatIDR(p.estimatedAnnualIncome)}/yr</span>
                  )}
                  {p.yieldOnCost != null && (
                    <span>{(p.yieldOnCost * 100).toFixed(1)}% yield on cost</span>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onRecord(p)}
                    className="h-auto p-0 text-xs ml-auto"
                  >
                    Record payout
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {calendar && calendar.paymentsCount > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next 12 months
                </p>
                <p className="text-xs font-medium">
                  ≈ {formatIDR(calendar.total)}
                </p>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {calendar.months.map((m, index) => {
                  const heightPercent =
                    maxMonthTotal > 0 && m.total > 0
                      ? Math.max(8, (m.total / maxMonthTotal) * 100)
                      : 0
                  const tooltip =
                    m.payments.length > 0
                      ? m.payments
                          .map((p) => `${p.symbol} ≈ ${formatIDR(p.amount)} (${formatDate(p.estimatedPayDate)})`)
                          .join("\n")
                      : "No payouts expected"

                  return (
                    <div
                      key={m.month}
                      title={`${monthLabel(m.month)}\n${tooltip}`}
                      className={`rounded-lg border p-1.5 text-center ${
                        index === 0 ? "ring-1 ring-primary/40" : ""
                      }`}
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {monthLabel(m.month)}
                      </p>
                      <div className="mt-1 flex h-10 items-end justify-center">
                        <div
                          className="w-full rounded-sm bg-emerald-500/70"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <p
                        className={`mt-1 text-[10px] ${
                          m.total > 0 ? "font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {m.total > 0 ? formatCompactIDR(m.total) : "—"}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              Estimated from dividend history — dates come from the payer&apos;s recent cadence, not
              a company announcement, and payouts are assumed to land about 3 weeks after the
              ex-dividend date. Actual amounts and dates may differ.
            </span>
          </p>
        </>
      )}
    </div>
  )
}
