"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  ArrowRight,
  CalendarClock,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCompactIDR, formatIDR } from "@/lib/utils"

interface ForecastEvent {
  id: string
  recurringId: string
  date: string
  type: "INCOME" | "EXPENSE"
  category: string
  description: string
  amount: number
}

interface ForecastData {
  windowDays: number
  startBalance: number
  projectedIncome: number
  projectedExpenses: number
  netChange: number
  endBalance: number
  events: ForecastEvent[]
}

export function ForecastCard() {
  const { data, isLoading, isError } = useQuery<ForecastData | null>({
    queryKey: ["forecast"],
    queryFn: async () => {
      const res = await fetch("/api/forecast")
      // Pro-only endpoint — free users simply don't see the card.
      if (res.status === 401 || res.status === 403) return null
      if (!res.ok) throw new Error("Failed to fetch forecast")
      return res.json()
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  if (isError || data === null) return null

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const positive = data.netChange >= 0
  const upcoming = data.events.slice(0, 5)
  const remaining = data.events.length - upcoming.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          {data.windowDays}-Day Cash Flow Forecast
        </CardTitle>
        <Button variant="link" size="sm" className="text-xs h-auto p-0" asChild>
          <Link href="/recurring">Manage recurring</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.events.length === 0 ? (
          <div className="text-center py-4">
            <div className="flex h-10 w-10 mx-auto rounded-full bg-muted/50 items-center justify-center mb-2">
              <CalendarClock className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium mb-1">
              No recurring income or bills in the next {data.windowDays} days
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Set up recurring transactions to see where your cash will land.
            </p>
            <Link href="/recurring">
              <Button variant="outline" size="sm">
                Add recurring transaction
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  Cash today
                </p>
                <p className="text-sm font-semibold">
                  {data.startBalance < 0 ? "−" : ""}
                  {formatCompactIDR(Math.abs(data.startBalance))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  Projected in
                </p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  +{formatCompactIDR(data.projectedIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  Projected out
                </p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  −{formatCompactIDR(data.projectedExpenses)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  In {data.windowDays} days
                </p>
                <p
                  className={`text-sm font-semibold ${
                    data.endBalance >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {data.endBalance < 0 ? "−" : ""}
                  {formatCompactIDR(Math.abs(data.endBalance))}
                </p>
                <Badge
                  variant={positive ? "profit" : "loss"}
                  className="mt-1 text-[10px]"
                >
                  {positive ? "+" : "−"}
                  {formatCompactIDR(Math.abs(data.netChange))} net
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground">
                Upcoming
              </h4>
              {upcoming.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-12 shrink-0">
                      {format(new Date(event.date), "MMM d")}
                    </span>
                    <span className="text-xs font-medium truncate">
                      {event.description}
                    </span>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline truncate">
                      {event.category.replace("_", " ")}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      event.type === "INCOME"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {event.type === "INCOME" ? "+" : "−"}
                    {formatIDR(event.amount)}
                  </span>
                </div>
              ))}
              {remaining > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  +{remaining} more recurring{" "}
                  {remaining === 1 ? "item" : "items"} in the next{" "}
                  {data.windowDays} days
                </p>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Based on active recurring transactions. One-off planned spending
              isn&apos;t included.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
