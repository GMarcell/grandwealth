"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  CircleDollarSign,
  Scale,
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCompactIDR, formatIDR } from "@/lib/utils";
import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamic import recharts (heavy charting library)
const MonthlyCashFlowChart = dynamic(
  () =>
    import("@/components/charts/dashboard-charts").then(
      (m) => m.MonthlyCashFlowChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 bg-muted/30 rounded-lg animate-pulse" />
    ),
  },
);

const WealthBreakdownChart = dynamic(
  () =>
    import("@/components/charts/dashboard-charts").then(
      (m) => m.WealthBreakdownChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 bg-muted/30 rounded-lg animate-pulse" />
    ),
  },
);

const NetWorthChart = dynamic(
  () =>
    import("@/components/charts/dashboard-charts").then((m) => m.NetWorthChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 bg-muted/30 rounded-lg animate-pulse" />
    ),
  },
);

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  /** Running balance carried into the next month (all-time net cash flow). */
  carriedBalance: number;
  totalGoldValue: number;
  totalGoldWeight: number;
  totalStockValue: number;
  stockCount: number;
  totalSavings: number;
  savingsAccountCount: number;
  totalWealth: number;
  totalDebt: number;
  loanCount: number;
  recentTransactions: Array<{
    id: string;
    type: string;
    category: string;
    amount: number;
    description: string;
    date: string;
  }>;
  monthlyData: Array<{
    month: string;
    income: number;
    expenses: number;
    /** income − expenses for the month. */
    net: number;
    /** Balance carried in from the previous month (negative for a deficit). */
    carryIn: number;
    /** Running balance carried into the next month. */
    balance: number;
  }>;
  budgetSummary: {
    totalBudgeted: number;
    totalEffective: number;
    totalRollover: number;
    totalSpent: number;
    remaining: number;
    budgetCount: number;
    overBudget: number;
    overBudgetEntries: Array<{
      categoryName: string;
      overspent: number;
      percentUsed: number;
    }>;
    nearLimitEntries: Array<{
      categoryName: string;
      remaining: number;
      percentUsed: number;
    }>;
  };
  latestAnalysis: {
    id: string;
    month: string;
    /** Budget-month label (e.g. "Sep 2026"), named after the month it ends in. */
    monthLabel?: string;
    summary: string;
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    overBudgetCount: number;
    createdAt: string;
  } | null;
  budget5050: {
    totalIncome: number;
    needs: { total: number; target: number; percent: number };
    wants: { total: number; target: number; percent: number };
    savings: { total: number; target: number; percent: number };
    uncategorized: { total: number; percent: number };
    categorizedCount: number;
    isHealthy: boolean;
  } | null;
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
  );
}

export function DashboardContent() {
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: netWorthData } = useQuery<{
    history: Array<{
      month: string;
      label: string;
      cash: number;
      gold: number;
      stocks: number;
      savings: number;
      debt: number;
      assets: number;
      total: number;
    }>;
  }>({
    queryKey: ["net-worth"],
    queryFn: async () => {
      const res = await fetch("/api/net-worth?months=12");
      if (!res.ok) throw new Error("Failed to fetch net worth history");
      return res.json();
    },
  });

  const netPositive = useMemo(
    () => (data?.netCashflow ?? 0) >= 0,
    [data?.netCashflow],
  );

  const carriedPositive = useMemo(
    () => (data?.carriedBalance ?? 0) >= 0,
    [data?.carriedBalance],
  );

  const pieData = useMemo(
    () =>
      [
        { name: "Cash Flow", value: Math.max(0, data?.netCashflow ?? 0) },
        { name: "Gold", value: data?.totalGoldValue ?? 0 },
        { name: "Stocks", value: data?.totalStockValue ?? 0 },
        { name: "Savings", value: Math.max(0, data?.totalSavings ?? 0) },
      ].filter((d) => d.value > 0),
    [
      data?.netCashflow,
      data?.totalGoldValue,
      data?.totalStockValue,
      data?.totalSavings,
    ],
  );

  // Show a seeded skeleton while the dashboard first loads. The static header
  // is already server-rendered, so we only mask the interactive content.
  if (isLoading) {
    return (
      <>
        {/* Hero card skeleton */}
        <div className="rounded-xl border bg-muted/30 p-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="shrink-0 h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </>
    );
  }

  const hasAnyData = data && (data.totalIncome > 0 || data.totalExpenses > 0 || data.totalWealth > 0);

  return (
    <>
      {/* Quick Actions + Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <Link href="/transactions?add=1" className="block">
                <Button variant="outline" className="w-full justify-start h-auto p-3" size="sm">
                  <ArrowLeftRight className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-sm">Add Transaction</span>
                </Button>
              </Link>
              <Link href="/budgets" className="block">
                <Button variant="outline" className="w-full justify-start h-auto p-3" size="sm">
                  <PiggyBank className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-sm">Set Budgets</span>
                </Button>
              </Link>
              <Link href="/gold" className="block">
                <Button variant="outline" className="w-full justify-start h-auto p-3" size="sm">
                  <CircleDollarSign className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-sm">Record Gold</span>
                </Button>
              </Link>
              <Link href="/stocks" className="block">
                <Button variant="outline" className="w-full justify-start h-auto p-3" size="sm">
                  <TrendingUp className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-sm">Add Stock</span>
                </Button>
              </Link>
              <Link href="/savings" className="block">
                <Button variant="outline" className="w-full justify-start h-auto p-3" size="sm">
                  <Landmark className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-sm">Record Savings</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="shrink-0"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Total Wealth Hero */}
      <Card className="bg-linear-to-br from-primary/5 via-primary/5 to-transparent border-primary/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Total Net Wealth
              </p>
              <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                {formatCompactIDR(data?.totalWealth ?? 0)}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  All-time net cash flow + gold + stocks + savings
                </p>
                {data && data.totalDebt > 0 && (
                  <Badge variant="loss" className="text-[10px]">
                    {formatCompactIDR(data.totalDebt)} debt
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards — 5 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Card className="hover:border-emerald-500/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCompactIDR(data?.totalIncome ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total income</p>
          </CardContent>
        </Card>

        <Card className="hover:border-red-500/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCompactIDR(data?.totalExpenses ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total expenses</p>
          </CardContent>
        </Card>

        <Card className={`hover:border-${netPositive ? 'emerald' : 'red'}-500/30 transition-colors`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              Net Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${netPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {netPositive ? "+" : ""}
              {formatCompactIDR(data?.netCashflow ?? 0)}
            </div>
            <Badge variant={netPositive ? "profit" : "loss"} className="mt-1">
              {netPositive ? "Surplus" : "Deficit"}
            </Badge>
          </CardContent>
        </Card>

        <Card className={`hover:border-${carriedPositive ? 'emerald' : 'red'}-500/30 transition-colors`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-muted-foreground" />
              Carried Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${carriedPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {carriedPositive ? "+" : ""}
              {formatCompactIDR(Math.abs(data?.carriedBalance ?? 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Carried into the next month
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">
              {formatCompactIDR(
                (data?.totalGoldValue ?? 0) +
                  (data?.totalStockValue ?? 0) +
                  (data?.totalSavings ?? 0),
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CircleDollarSign className="h-3 w-3" />
                {(data?.totalGoldWeight ?? 0).toFixed(2)}g gold
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {data?.stockCount ?? 0} stocks
              </span>
              {data?.savingsAccountCount != null &&
                data.savingsAccountCount > 0 && (
                  <span className="flex items-center gap-1">
                    <PiggyBank className="h-3 w-3" />
                    {data.savingsAccountCount}{' '}
                    {data.savingsAccountCount === 1 ? 'account' : 'accounts'}
                  </span>
                )
              }
              {data?.loanCount ? (
                <span className="flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  {data.loanCount}{' '}
                  {data.loanCount === 1 ? 'loan' : 'loans'}
                </span>
              ) : null}
            </div>
            {data && data.totalDebt > 0 && (
              <Badge variant="loss" className="mt-2">
                {formatCompactIDR(data.totalDebt)} debt
              </Badge>
            )}
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
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0"
              asChild
            >
              <Link href="/settings">Configure</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-4">
                {/* Needs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Home className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">Needs</span>
                      <span className="text-[10px] text-muted-foreground">(50% target)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.needs.total)}
                      </span>
                      <span className="text-xs text-muted-foreground">/</span>
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.needs.target)}
                      </span>
                      <Badge
                        variant={data.budget5050.needs.percent <= 50 ? 'secondary' : 'destructive'}
                        className="ml-1"
                      >
                        {data.budget5050.needs.percent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.budget5050.needs.percent <= 50
                          ? "bg-blue-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(data.budget5050.needs.percent, 100)}%`,
                      }}
                    />
                  </div>
                  {data.budget5050.needs.percent > 50 && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5" />
                      {formatCompactIDR(data.budget5050.needs.total - data.budget5050.needs.target)} over target
                    </p>
                  )}
                </div>

                {/* Wants */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">Wants</span>
                      <span className="text-[10px] text-muted-foreground">(30% target)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.wants.total)}
                      </span>
                      <span className="text-xs text-muted-foreground">/</span>
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.wants.target)}
                      </span>
                      <Badge
                        variant={data.budget5050.wants.percent <= 30 ? 'secondary' : 'destructive'}
                        className="ml-1"
                      >
                        {data.budget5050.wants.percent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.budget5050.wants.percent <= 30
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(data.budget5050.wants.percent, 100)}%`,
                      }}
                    />
                  </div>
                  {data.budget5050.wants.percent > 30 && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5" />
                      {formatCompactIDR(data.budget5050.wants.total - data.budget5050.wants.target)} over target
                    </p>
                  )}
                </div>

                {/* Savings */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <PiggyBank className="h-4 w-4 text-emerald-500" />
                      <span className="font-medium text-sm">Savings</span>
                      <span className="text-[10px] text-muted-foreground">(20% target)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.savings.total)}
                      </span>
                      <span className="text-xs text-muted-foreground">/</span>
                      <span className="text-muted-foreground">
                        {formatCompactIDR(data.budget5050.savings.target)}
                      </span>
                      <Badge
                        variant={data.budget5050.savings.percent >= 20 ? 'secondary' : 'destructive'}
                        className="ml-1"
                      >
                        {data.budget5050.savings.percent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.budget5050.savings.percent >= 20
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(data.budget5050.savings.percent, 100)}%`,
                      }}
                    />
                  </div>
                  {data.budget5050.savings.percent < 20 && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5" />
                      {formatCompactIDR(data.budget5050.savings.target - data.budget5050.savings.total)} short of target
                    </p>
                  )}
                </div>
              </div>

              {data.budget5050.uncategorized.total > 0 && (
                <div className="rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        {formatCompactIDR(data.budget5050.uncategorized.total)}{" "}
                        uncategorized expenses
                      </p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">
                        Assign rule types to all expense categories in Settings
                        for an accurate 50/30/20 breakdown.
                      </p>
                    </div>
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
          <Card className="border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer group mb-5">
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
                      {data.latestAnalysis.monthLabel ?? data.latestAnalysis.month}{" "}
                      &bull; Generated{" "}
                      {new Date(
                        data.latestAnalysis.createdAt,
                      ).toLocaleDateString("en-US")}
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
                  <p
                    className={`text-sm font-semibold ${
                      data.latestAnalysis.netSavings >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCompactIDR(data.latestAnalysis.netSavings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Percent className="h-3 w-3" />
                    Savings Rate
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      data.latestAnalysis.savingsRate >= 20
                        ? "text-emerald-600 dark:text-emerald-400"
                        : data.latestAnalysis.savingsRate >= 10
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {data.latestAnalysis.savingsRate.toFixed(1)}%
                  </p>
                </div>
                {data.latestAnalysis.overBudgetCount > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Over Budget</p>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {data.latestAnalysis.overBudgetCount}{" "}
                      {data.latestAnalysis.overBudgetCount === 1
                        ? "category"
                        : "categories"}
                    </p>
                  </div>
                )}
              </div>

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

      {/* Net Wealth Trend */}
      <NetWorthChart data={netWorthData?.history ?? []} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthlyCashFlowChart data={data?.monthlyData ?? []} />
        <WealthBreakdownChart data={pieData} />
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Budget vs Spent</span>
                <span className="font-medium">
                  {formatCompactIDR(data.budgetSummary.totalSpent)} /{" "}
                  {formatCompactIDR(
                    data.budgetSummary.totalEffective ||
                      data.budgetSummary.totalBudgeted,
                  )}
                </span>
              </div>
              {data.budgetSummary.totalRollover > 0 && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>
                    +{formatCompactIDR(data.budgetSummary.totalRollover)}{" "}
                    rollover from last month
                  </span>
                </div>
              )}
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (data.budgetSummary.totalEffective ||
                      data.budgetSummary.totalBudgeted) > 0 &&
                    data.budgetSummary.totalSpent /
                      (data.budgetSummary.totalEffective ||
                        data.budgetSummary.totalBudgeted) >
                      0.8
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${
                      (data.budgetSummary.totalEffective ||
                        data.budgetSummary.totalBudgeted) > 0
                        ? Math.min(
                            (data.budgetSummary.totalSpent /
                              (data.budgetSummary.totalEffective ||
                                data.budgetSummary.totalBudgeted)) *
                              100,
                            100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

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
                        {formatCompactIDR(entry.overspent)} over (
                        {entry.percentUsed}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                        {formatCompactIDR(entry.remaining)} left (
                        {entry.percentUsed}%)
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

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Link href="/transactions">
            <Button variant="link" size="sm" className="text-xs h-auto p-0">
              View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.recentTransactions && data.recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {data.recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                        tx.type === "INCOME"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {tx.type === "INCOME" ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{tx.category.replace("_", " ")}</span>
                        <span>&bull;</span>
                        <span>{new Date(tx.date).toLocaleDateString("en-US", {
                          month: 'short',
                          day: 'numeric',
                        })}</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-semibold shrink-0 ${
                      tx.type === "INCOME"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : "-"}
                    {formatIDR(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : hasAnyData ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">
                No recent transactions this month.
              </p>
              <Link href="/transactions?add=1">
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add transaction
                </Button>
              </Link>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="flex h-12 w-12 mx-auto rounded-full bg-muted/50 items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Get started by adding your first transaction
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Track income and expenses to see your financial overview
              </p>
              <Link href="/transactions?add=1">
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add your first transaction
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
