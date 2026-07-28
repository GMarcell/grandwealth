"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  RefreshCw,
  X,
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
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

const REGENERATION_STEPS = [
  { icon: "📊", text: "Analyzing your financial data..." },
  { icon: "🔍", text: "Reviewing transactions & budgets..." },
  { icon: "🧠", text: "Crunching the numbers..." },
  { icon: "💡", text: "Generating AI insights..." },
  { icon: "✨", text: "Finalizing your report..." },
]

function RegenerationOverlay({ onCancel }: { onCancel: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    startTimeRef.current = Date.now()
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        // Slow down progression over time (stay on later steps longer)
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const maxStep = Math.min(
          Math.floor(elapsed / 3),
          REGENERATION_STEPS.length - 1
        )
        return Math.min(prev + 1, maxStep)
      })
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      {/* Content */}
      <div className="relative z-50 flex flex-col items-center gap-6 px-4">
        {/* Spinner ring */}
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-purple-200 dark:border-purple-900" />
          <div className="absolute inset-0 h-20 w-20 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="h-8 w-8 text-purple-500 animate-pulse" />
          </div>
        </div>
        {/* Status text */}
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">
            Regenerating AI Analysis
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground min-h-[20px]">
            <span className="animate-in fade-in-0 duration-300" key={stepIndex}>
              {REGENERATION_STEPS[stepIndex].icon}{" "}
              {REGENERATION_STEPS[stepIndex].text}
            </span>
          </div>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1.5">
          {REGENERATION_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
                i <= stepIndex
                  ? "bg-purple-500 scale-125"
                  : "bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>
        {/* Cancel button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="gap-2 mt-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  )
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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

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

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: async (month: string) => {
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const res = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to regenerate analysis")
        }
        return res.json()
      } finally {
        abortControllerRef.current = null
      }
    },
    onSuccess: () => {
      toast.success("Analysis regenerated successfully!")
      queryClient.invalidateQueries({ queryKey: ["analysis"] })
      queryClient.invalidateQueries({ queryKey: ["analysis-list"] })
    },
    onError: (err) => {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("Analysis regeneration cancelled")
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to regenerate analysis")
      }
    },
  })

  const handleCancelRegeneration = () => {
    abortControllerRef.current?.abort()
  }

  const isLoading = listLoading || analysisLoading

  if (isLoading) return <AnalysisSkeleton />

  return (
    <div className="space-y-6 relative">
      {/* Regeneration overlay */}
      {regenerateMutation.isPending && (
        <RegenerationOverlay onCancel={handleCancelRegeneration} />
      )}

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

          {/* Regenerate & Monthly Milestone */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Generated {new Date(analysis.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={regenerateMutation.isPending}
                  className="gap-2"
                >
                  {regenerateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {regenerateMutation.isPending ? "Regenerating..." : "Regenerate Analysis"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate Analysis?</DialogTitle>
                  <DialogDescription>
                    This will generate a new AI analysis for {formatMonthLabel(analysis.month)} based on your current financial data. The existing analysis will be replaced.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => {
                      setConfirmDialogOpen(false)
                      regenerateMutation.mutate(analysis.month)
                    }}
                    autoFocus
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}
    </div>
  )
}
