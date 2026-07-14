"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Brain,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Calendar,
  Loader2,
  Wallet,
  Target,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Percent,
  Coins,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatIDR, formatCompactIDR } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface AnalysisSummary {
  id: string
  month: string
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  topCategory: string | null
  stockValue: number | null
  goldValue: number | null
  budgetCount: number
  overBudgetCount: number
  transactionCount: number
  createdAt: string
}

interface FullAnalysis extends AnalysisSummary {
  summary: string
  rawData: any
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function formatMonthLabel(monthKey: string): string {
  const [year, m] = monthKey.split("-")
  return `${monthNames[parseInt(m) - 1]} ${year}`
}

export default function AnalysisPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("latest")

  // Fetch list of all analysis months
  const { data: listData, isLoading: listLoading } = useQuery<{
    analyses: AnalysisSummary[]
  }>({
    queryKey: ["analysis-list"],
    queryFn: async () => {
      const res = await fetch("/api/analysis")
      if (!res.ok) throw new Error("Failed to fetch analysis list")
      return res.json()
    },
  })

  // Determine the month to show
  const effectiveMonth =
    selectedMonth === "latest"
      ? listData?.analyses?.[0]?.month
      : selectedMonth

  // Fetch full analysis for the selected month
  const { data: analysis, isLoading: analysisLoading } = useQuery<FullAnalysis>({
    queryKey: ["analysis", effectiveMonth],
    queryFn: async () => {
      if (!effectiveMonth) throw new Error("No month selected")
      const res = await fetch(`/api/analysis?month=${effectiveMonth}`)
      if (!res.ok) throw new Error("Failed to fetch analysis")
      return res.json()
    },
    enabled: !!effectiveMonth,
  })

  const isLoading = listLoading || analysisLoading

  if (isLoading) return <AnalysisSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            AI Monthly Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Personalized financial insights powered by AI
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={selectedMonth}
            onValueChange={(v) => setSelectedMonth(v)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest analysis</SelectItem>
              {listData?.analyses?.map((a) => (
                <SelectItem key={a.month} value={a.month}>
                  {formatMonthLabel(a.month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!analysis ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No analysis available yet. The monthly analysis is generated at the end of each month.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCompactIDR(analysis.totalIncome)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMonthLabel(analysis.month)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCompactIDR(analysis.totalExpenses)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analysis.transactionCount} transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
                <PiggyBank className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  analysis.netSavings >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {formatCompactIDR(analysis.netSavings)}
                </div>
                <Badge
                  variant={analysis.netSavings >= 0 ? "profit" : "loss"}
                  className="mt-1"
                >
                  {analysis.netSavings >= 0 ? "Surplus" : "Deficit"}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
                <Percent className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  analysis.savingsRate >= 20
                    ? "text-emerald-600 dark:text-emerald-400"
                    : analysis.savingsRate >= 10
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {analysis.savingsRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analysis.savingsRate >= 20
                    ? "Excellent! 🎉"
                    : analysis.savingsRate >= 10
                    ? "Good progress"
                    : "Room for improvement"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Summary (if any) */}
          {(analysis.stockValue || analysis.goldValue) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {analysis.stockValue != null && analysis.stockValue > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Stock Portfolio</CardTitle>
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCompactIDR(analysis.stockValue)}
                    </div>
                  </CardContent>
                </Card>
              )}
              {analysis.goldValue != null && analysis.goldValue > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Gold Holdings</CardTitle>
                    <Coins className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCompactIDR(analysis.goldValue)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Budget Alert */}
          {analysis.overBudgetCount > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="flex items-start gap-3 py-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {analysis.overBudgetCount} budget{analysis.overBudgetCount > 1 ? "s" : ""} exceeded
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Out of {analysis.budgetCount} active budget{analysis.budgetCount > 1 ? "s" : ""} this month.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Report */}
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-5 w-5" />
                AI Analysis Report — {formatMonthLabel(analysis.month)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {analysis.summary.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return (
                      <h2 key={i} className="text-lg font-bold mt-6 mb-2 text-foreground">
                        {line.replace("## ", "")}
                      </h2>
                    )
                  }
                  if (line.startsWith("### ")) {
                    return (
                      <h3 key={i} className="text-base font-semibold mt-4 mb-1 text-foreground">
                        {line.replace("### ", "")}
                      </h3>
                    )
                  }
                  if (line.startsWith("- ") || line.startsWith("* ")) {
                    return (
                      <li key={i} className="ml-4 text-sm text-muted-foreground list-disc">
                        {line.replace(/^[-*] /, "")}
                      </li>
                    )
                  }
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return (
                      <p key={i} className="font-semibold text-foreground mt-3">
                        {line.replace(/\*\*/g, "")}
                      </p>
                    )
                  }
                  if (line.trim() === "") {
                    return <div key={i} className="h-2" />
                  }
                  return (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                      {line}
                    </p>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Milestone */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Analysis generated on {new Date(analysis.createdAt).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </>
      )}
    </div>
  )
}
