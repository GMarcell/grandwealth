"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Loader2,
  Calendar,
  Wallet,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import dynamic from "next/dynamic"
import { toast } from "sonner"

// Dynamic import chart components (ships recharts only when rendered)
const MonthlyBarChart = dynamic(
  () => import("@/components/charts/reports-charts").then((m) => m.MonthlyBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 bg-muted/30 rounded-lg animate-pulse" />
    ),
  },
)

const CategoryPieChart = dynamic(
  () => import("@/components/charts/reports-charts").then((m) => m.CategoryPieChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
    ),
  },
)

interface ReportData {
  summary: {
    totalIncome: number
    totalExpenses: number
    netCashflow: number
    avgMonthlyIncome: number
    avgMonthlyExpenses: number
    avgMonthlyNet: number
    monthsInRange: number
    totalTransactions: number
  }
  monthlyBreakdown: Array<{
    month: string
    label: string
    income: number
    expenses: number
    net: number
    transactionCount: number
  }>
  currentMonthSpending: Array<{ category: string; total: number }>
  categoryBreakdown: {
    income: Array<{ category: string; total: number }>
    expense: Array<{ category: string; total: number }>
  }
  currentMonth: {
    income: number
    incomeTotal: number
    expenseTotal: number
  }
}



function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [monthRange, setMonthRange] = useState("12")

  const { data, isLoading, refetch } = useQuery<ReportData>({
    queryKey: ["reports", monthRange],
    queryFn: async () => {
      const res = await fetch(`/api/reports?months=${monthRange}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  })

  if (isLoading) return <ReportSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-sm text-muted-foreground">
            Analyze your spending patterns and financial trends
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={monthRange} onValueChange={setMonthRange}>
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto">
            <Loader2 className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCompactIDR(data?.summary.totalIncome ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Over {data?.summary.monthsInRange ?? 0} months
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
              {formatCompactIDR(data?.summary.totalExpenses ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Over {data?.summary.monthsInRange ?? 0} months
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (data?.summary.netCashflow ?? 0) >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {formatCompactIDR(data?.summary.netCashflow ?? 0)}
            </div>
            <Badge
              variant={(data?.summary.netCashflow ?? 0) >= 0 ? "profit" : "loss"}
              className="mt-1"
            >
              {(data?.summary.netCashflow ?? 0) >= 0 ? "Surplus" : "Deficit"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Monthly Net</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (data?.summary.avgMonthlyNet ?? 0) >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {formatCompactIDR(data?.summary.avgMonthlyNet ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average per month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Income vs Expenses Bar Chart — dynamically loaded */}
      <MonthlyBarChart data={data?.monthlyBreakdown ?? []} />

      {/* Category Breakdown Charts — dynamically loaded */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryPieChart
          data={data?.categoryBreakdown.expense ?? []}
          title="Expenses by Category"
          type="expense"
        />
        <CategoryPieChart
          data={data?.categoryBreakdown.income ?? []}
          title="Income by Category"
          type="income"
        />
      </div>

      {/* Monthly Breakdown Table */}
      {data?.monthlyBreakdown && data.monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium text-muted-foreground py-2 pr-4">
                      Month
                    </th>
                    <th className="text-right font-medium text-muted-foreground py-2 px-2">
                      Income
                    </th>
                    <th className="text-right font-medium text-muted-foreground py-2 px-2">
                      Expenses
                    </th>
                    <th className="text-right font-medium text-muted-foreground py-2 px-2">
                      Net
                    </th>
                    <th className="text-right font-medium text-muted-foreground py-2 pl-2">
                      Transactions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBreakdown.map((m) => (
                    <tr key={m.month} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 pr-4 font-medium">{m.label}</td>
                      <td className="py-2.5 px-2 text-right text-emerald-600 dark:text-emerald-400">
                        {formatIDR(m.income)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-red-600 dark:text-red-400">
                        {formatIDR(m.expenses)}
                      </td>
                      <td className={`py-2.5 px-2 text-right font-medium ${
                        m.net >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {m.net >= 0 ? "+" : ""}{formatIDR(m.net)}
                      </td>
                      <td className="py-2.5 pl-2 text-right text-muted-foreground">
                        {m.transactionCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
