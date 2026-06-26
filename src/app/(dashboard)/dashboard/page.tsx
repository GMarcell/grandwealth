"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  CircleDollarSign,
  Wallet,
  RefreshCw,
  Landmark,
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
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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

  const netPositive = (data?.netCashflow ?? 0) >= 0

  // Pie chart data for wealth breakdown
  const pieData = [
    { name: "Cash Flow", value: Math.max(0, data?.netCashflow ?? 0) },
    { name: "Gold", value: data?.totalGoldValue ?? 0 },
    { name: "Stocks", value: data?.totalStockValue ?? 0 },
  ].filter((d) => d.value > 0)

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
                Sum of cash flow, gold, and stock values
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
            <CardTitle className="text-sm font-medium">Gold & Stocks</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCompactIDR((data?.totalGoldValue ?? 0) + (data?.totalStockValue ?? 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(data?.totalGoldWeight ?? 0).toFixed(2)}g gold &bull; {data?.stockCount ?? 0} stocks
            </p>
          </CardContent>
        </Card>
      </div>

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
