"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Download,
  FileUp,
  Loader2,
  PieChart,
  BarChart3,
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
import { CHART_COLORS, SEMANTIC_COLOR_INCOME, SEMANTIC_COLOR_EXPENSE } from "@/lib/chart-colors"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import { toast } from "sonner"

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

      {/* Monthly Income vs Expenses Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Income vs Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyBreakdown ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  fontSize={11}
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
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill={SEMANTIC_COLOR_INCOME}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill={SEMANTIC_COLOR_EXPENSE}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Expense by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.categoryBreakdown.expense &&
            data.categoryBreakdown.expense.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={data.categoryBreakdown.expense.map((e) => ({
                          name: e.category.replace("_", " "),
                          value: e.total,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.categoryBreakdown.expense.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
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
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                  {data.categoryBreakdown.expense.slice(0, 8).map((e, i) => (
                    <div key={e.category} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-xs text-muted-foreground truncate max-w-24">
                        {e.category.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
                {data.categoryBreakdown.expense.length > 8 && (
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    +{data.categoryBreakdown.expense.length - 8} more categories
                  </p>
                )}
              </>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No expense data in this period.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Income by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.categoryBreakdown.income &&
            data.categoryBreakdown.income.length > 0 ? (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={data.categoryBreakdown.income.map((e) => ({
                          name: e.category.replace("_", " "),
                          value: e.total,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.categoryBreakdown.income.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
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
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                  {data.categoryBreakdown.income.map((e, i) => (
                    <div key={e.category} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-xs text-muted-foreground truncate max-w-24">
                        {e.category.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No income data in this period.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
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
