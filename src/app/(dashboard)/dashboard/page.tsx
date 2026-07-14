"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  CircleDollarSign,
  Wallet,
  RefreshCw,
  Landmark,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Sparkles,
  Percent,
  Home,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatCompactIDR, formatIDR } from "@/lib/utils"
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import Link from "next/link"

interface DashboardData {
  totalIncome: number
  totalExpenses: number
  netCashflow: number
  totalGoldValue: number
  totalGoldWeight: number
  totalStockValue: number
  stockCount: number
  totalSavings: number
  savingsAccountCount: number
  totalWealth: number
  recentTransactions: Array<{
    id: string
    type: string
    category: string
    amount: number
    description: string
    date: string
  }>
  monthlyData: Array<{
    month: string
    income: number
    expenses: number
  }>
  budgetSummary: {
    totalBudgeted: number
    totalEffective: number
    totalRollover: number
    totalSpent: number
    remaining: number
    budgetCount: number
    overBudget: number
    overBudgetEntries: Array<{ categoryName: string; overspent: number; percentUsed: number }>
    nearLimitEntries: Array<{ categoryName: string; remaining: number; percentUsed: number }>
  }
  latestAnalysis: {
    id: string
    month: string
    summary: string
    totalIncome: number
    totalExpenses: number
    netSavings: number
    savingsRate: number
    overBudgetCount: number
    createdAt: string
  } | null
  budget5050: {
    totalIncome: number
    needs: { total: number; target: number; percent: number }
    wants: { total: number; target: number; percent: number }
    savings: { total: number; target: number; percent: number }
    uncategorized: { total: number; percent: number }
    categorizedCount: number
    isHealthy: boolean
  } | null
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

export default function DashboardPage() {
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 60_000,
  })

  // Memoize computed values to prevent unnecessary recalculations
  const netPositive = useMemo(() => (data?.netCashflow ?? 0) >= 0, [data?.netCashflow])

  // Pie chart data for wealth breakdown
  const pieData = useMemo(() =>
    [
      { name: "Cash Flow", value: Math.max(0, data?.netCashflow ?? 0) },
      { name: "Gold", value: data?.totalGoldValue ?? 0 },
      { name: "Stocks", value: data?.totalStockValue ?? 0 },
      { name: "Savings", value: Math.max(0, data?.totalSavings ?? 0) },
    ].filter((d) => d.value > 0),
    [data?.netCashflow, data?.totalGoldValue, data?.totalStockValue, data?.totalSavings]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your complete wealth overview
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Total Wealth Hero */}
      <Card className="bg-gradient-to-br from-primary/5 via-primary/5 to-transparent border-primary/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Net Wealth</p>
              <p className="text-4xl font-bold tracking-tight">
                {formatCompactIDR(data?.totalWealth ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Cash flow + gold + stocks + bank savings
              </p>
            </div>
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCompactIDR(data?.totalIncome ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCompactIDR(data?.totalExpenses ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {netPositive ? "+" : ""}{formatCompactIDR(data?.netCashflow ?? 0)}
            </div>
            <Badge variant={netPositive ? "profit" : "loss"} className="mt-1">
              {netPositive ? "Surplus" : "Deficit"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCompactIDR((data?.totalGoldValue ?? 0) + (data?.totalStockValue ?? 0) + (data?.totalSavings ?? 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(data?.totalGoldWeight ?? 0).toFixed(2)}g gold &bull; {data?.stockCount ?? 0} stocks
              {data?.savingsAccountCount != null && data.savingsAccountCount > 0 && (
                <> &bull; {data.savingsAccountCount} {data.savingsAccountCount === 1 ? "account" : "accounts"}</>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 50/30/20 Budget Rule Widget */}
      {data?.budget5050 && data.budget5050.totalIncome > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Percent className="h-4 w-4" />
                50/30/20 Budget Rule
              </CardTitle>
              {data.budget5050.isHealthy ? (
                <Badge variant="profit" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                  On Track
                </Badge>
              ) : (
                <Badge variant="loss" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  Needs Attention
                </Badge>
              )}
            </div>
            <Button variant="link" size="sm" className="text-xs h-auto p-0" asChild>
              <Link href="/settings">Configure</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress bars */}
              <div className="space-y-3">
                {/* Needs - 50% */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5 text-blue-500" />
                      <span className="font-medium">Needs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.needs.total)} / {formatCompactIDR(data.budget5050.needs.target)}
                      </span>
                      <span className={`font-semibold min-w-[3rem] text-right ${
                        data.budget5050.needs.percent <= 50
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {data.budget5050.needs.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.budget5050.needs.percent <= 50
                          ? "bg-blue-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(data.budget5050.needs.percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Target: 50%</span>
                    {data.budget5050.needs.percent > 50 && (
                      <span className="text-red-500">
                        {formatCompactIDR(data.budget5050.needs.total - data.budget5050.needs.target)} over
                      </span>
                    )}
                  </div>
                </div>

                {/* Wants - 30% */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-medium">Wants</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.wants.total)} / {formatCompactIDR(data.budget5050.wants.target)}
                      </span>
                      <span className={`font-semibold min-w-[3rem] text-right ${
                        data.budget5050.wants.percent <= 30
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {data.budget5050.wants.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.budget5050.wants.percent <= 30
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(data.budget5050.wants.percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Target: 30%</span>
                    {data.budget5050.wants.percent > 30 && (
                      <span className="text-red-500">
                        {formatCompactIDR(data.budget5050.wants.total - data.budget5050.wants.target)} over
                      </span>
                    )}
                  </div>
                </div>

                {/* Savings - 20% */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <PiggyBank className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-medium">Savings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.savings.total)} / {formatCompactIDR(data.budget5050.savings.target)}
                      </span>
                      <span className={`font-semibold min-w-[3rem] text-right ${
                        data.budget5050.savings.percent >= 20
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {data.budget5050.savings.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.budget5050.savings.percent >= 20
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(data.budget5050.savings.percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Target: 20%</span>
                    {data.budget5050.savings.percent < 20 && (
                      <span className="text-red-500">
                        {formatCompactIDR(data.budget5050.savings.target - data.budget5050.savings.total)} short
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Uncategorized warning */}
              {data.budget5050.uncategorized.total > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {formatCompactIDR(data.budget5050.uncategorized.total)} uncategorized
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                      Assign rule types to all expense categories in Settings for an accurate breakdown.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Widget */}
      {data?.latestAnalysis && (
        <Link href="/analysis">
          <Card className="border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50">
                    <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      AI Monthly Analysis
                      <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.latestAnalysis.month} &bull; Generated {new Date(data.latestAnalysis.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  View full report
                  <span className="text-lg leading-none">&rarr;</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Income</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCompactIDR(data.latestAnalysis.totalIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expenses</p>
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {formatCompactIDR(data.latestAnalysis.totalExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Savings</p>
                  <p className={`text-sm font-semibold ${
                    data.latestAnalysis.netSavings >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {formatCompactIDR(data.latestAnalysis.netSavings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Percent className="h-3 w-3" />
                    Savings Rate
                  </p>
                  <p className={`text-sm font-semibold ${
                    data.latestAnalysis.savingsRate >= 20
                      ? "text-emerald-600 dark:text-emerald-400"
                      : data.latestAnalysis.savingsRate >= 10
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {data.latestAnalysis.savingsRate.toFixed(1)}%
                  </p>
                </div>
                {data.latestAnalysis.overBudgetCount > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Over Budget</p>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {data.latestAnalysis.overBudgetCount} {data.latestAnalysis.overBudgetCount === 1 ? "category" : "categories"}
                    </p>
                  </div>
                )}
              </div>

              {/* AI Summary Preview */}
              <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                {data.latestAnalysis.summary
                  .replace(/## /g, "")
                  .replace(/### /g, "")
                  .replace(/[*_]/g, "")
                  .split("\n")
                  .filter((l) => l.trim())
                  .slice(0, 2)
                  .join(" · ")}
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Income vs Expenses Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={data?.monthlyData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="month"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v) => formatCompactIDR(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: any) => [formatIDR(Number(value))]}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Income"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Expenses"
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Wealth Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Wealth Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: any) => [formatIDR(Number(value))]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet. Start adding your wealth!</p>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Summary Card */}
      {data?.budgetSummary && data.budgetSummary.budgetCount > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                Monthly Budget
              </CardTitle>
              {data.budgetSummary.overBudget > 0 && (
                <Badge variant="loss" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  {data.budgetSummary.overBudget} over
                </Badge>
              )}
            </div>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Budget vs Spent</span>
                <span className="font-medium">
                  {formatCompactIDR(data.budgetSummary.totalSpent)} /{" "}
                  {formatCompactIDR(data.budgetSummary.totalEffective || data.budgetSummary.totalBudgeted)}
                </span>
              </div>
              {data.budgetSummary.totalRollover > 0 && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>+{formatCompactIDR(data.budgetSummary.totalRollover)} rollover from last month</span>
                </div>
              )}
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (data.budgetSummary.totalEffective || data.budgetSummary.totalBudgeted) > 0 &&
                    data.budgetSummary.totalSpent / (data.budgetSummary.totalEffective || data.budgetSummary.totalBudgeted) > 0.8
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${
                      (data.budgetSummary.totalEffective || data.budgetSummary.totalBudgeted) > 0
                        ? Math.min(
                            (data.budgetSummary.totalSpent /
                              (data.budgetSummary.totalEffective || data.budgetSummary.totalBudgeted)) *
                              100,
                            100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Over-budget alerts */}
            {data.budgetSummary.overBudgetEntries?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Over Budget
                </h4>
                <div className="space-y-1.5">
                  {data.budgetSummary.overBudgetEntries.map((entry) => (
                    <div
                      key={entry.categoryName}
                      className="flex items-center justify-between rounded-md bg-red-500/5 border border-red-500/20 px-3 py-1.5"
                    >
                      <span className="text-xs font-medium">
                        {entry.categoryName.replace("_", " ")}
                      </span>
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                        {formatCompactIDR(entry.overspent)} over ({entry.percentUsed}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Near-limit alerts */}
            {data.budgetSummary.nearLimitEntries?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Near Limit (80%+)
                </h4>
                <div className="space-y-1.5">
                  {data.budgetSummary.nearLimitEntries.map((entry) => (
                    <div
                      key={entry.categoryName}
                      className="flex items-center justify-between rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-1.5"
                    >
                      <span className="text-xs font-medium">
                        {entry.categoryName.replace("_", " ")}
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {formatCompactIDR(entry.remaining)} left ({entry.percentUsed}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {data.budgetSummary.budgetCount} categories budgeted
              </span>
              <Link href="/budgets">
                <Button variant="link" size="sm" className="text-xs h-auto p-0">
                  Manage budgets
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions & Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/transactions" className="block">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </Link>
            <Link href="/budgets" className="block">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <PiggyBank className="h-4 w-4 mr-2" />
                Set Budgets
              </Button>
            </Link>
            <Link href="/gold" className="block">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <CircleDollarSign className="h-4 w-4 mr-2" />
                Record Gold
              </Button>
            </Link>
            <Link href="/stocks" className="block">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <TrendingUp className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            </Link>
            <Link href="/savings" className="block">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <Landmark className="h-4 w-4 mr-2" />
                Record Savings
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                data.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        tx.type === "INCOME"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}>
                        {tx.type === "INCOME" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category.replace("_", " ")} &bull; {new Date(tx.date).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${
                      tx.type === "INCOME"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatIDR(tx.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">
                    No transactions yet.
                  </p>
                  <Link href="/transactions">
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add your first transaction
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
