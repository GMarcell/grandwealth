"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { budgetFormSchema } from "@/lib/validation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  PieChart,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/ui/form-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR, formatCompactIDR } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-colors";
import {
  getBudgetMonthKey,
  getCurrentBudgetMonthKey,
  getPreviousBudgetMonthKey,
  getBudgetMonthRange,
  getBudgetMonthLabel,
  generateBudgetMonths,
} from "@/lib/budget-months";
import { toast } from "sonner";
import {
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const EXPENSE_CATEGORIES = [
  "FOOD",
  "TRANSPORTATION",
  "HOUSING",
  "UTILITIES",
  "HEALTHCARE",
  "EDUCATION",
  "ENTERTAINMENT",
  "SHOPPING",
  "TRAVEL",
  "INSURANCE",
  "TAX",
  "SUBSCRIPTION",
  "OTHER_EXPENSE",
] as const;

interface Budget {
  id: string;
  categoryName: string;
  amount: number;
  month: string;
  rolloverEnabled: boolean;
  rolloverCap: number | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface TransactionSummary {
  category: string;
  total: number;
}

type BudgetFormData = z.infer<typeof budgetFormSchema>;


export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryName: "",
      amount: "",
      rolloverEnabled: true,
      rolloverCap: "",
    },
  });

  const formRolloverEnabled = watch("rolloverEnabled");

  const { data: budgetSettings } = useQuery<{ budgetStartDay: number }>({
    queryKey: ["budget-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/budget-settings");
      if (!res.ok) throw new Error("Failed to fetch budget settings");
      return res.json();
    },
  });

  const startDay = budgetSettings?.budgetStartDay ?? 1;

  const currentMonthKey = useMemo(() => getCurrentBudgetMonthKey(startDay), [startDay]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const MONTHS = useMemo(() => generateBudgetMonths(12, startDay), [startDay]);

  // Sync to current month when startDay changes
  const [prevStartDay, setPrevStartDay] = useState(startDay);
  if (prevStartDay !== startDay) {
    setPrevStartDay(startDay);
    setSelectedMonth(getCurrentBudgetMonthKey(startDay));
  }

  const { data: budgets, isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: async () => {
      const res = await fetch("/api/budgets");
      if (!res.ok) throw new Error("Failed to fetch budgets");
      return res.json();
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: transactions } = useQuery<any[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save budget" }))
        throw new Error(err.error || "Failed to save budget")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget saved");
      resetForm();
    },
    onError: (err) => toast.error(err.message || "Failed to save budget"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete budget" }))
        throw new Error(err.error || "Failed to delete budget")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete budget"),
  });

  function resetForm() {
    setEditingBudget(null);
    reset({
      categoryName: "",
      amount: "",
      rolloverEnabled: true,
      rolloverCap: "",
    });
    setIsDialogOpen(false);
  }

  function openEdit(budget: Budget) {
    setEditingBudget(budget);
    reset({
      categoryName: budget.categoryName,
      amount: budget.amount.toString(),
      rolloverEnabled: budget.rolloverEnabled,
      rolloverCap: budget.rolloverCap != null ? budget.rolloverCap.toString() : "",
    });
    setIsDialogOpen(true);
  }

  function onFormSubmit(data: BudgetFormData) {
    createMutation.mutate({
      categoryName: data.categoryName,
      amount: parseFloat(data.amount),
      month: selectedMonth,
      rolloverEnabled: data.rolloverEnabled,
      rolloverCap: data.rolloverCap ? parseFloat(data.rolloverCap) : null,
    });
  }

  // Derive all available expense categories: predefined + user-defined
  const userExpenseCategories = (categories ?? [])
    .filter((c) => c.type === "EXPENSE")
    .map((c) => c.name);

  const allExpenseCategories = [
    ...EXPENSE_CATEGORIES,
    ...userExpenseCategories,
  ];
  const uniqueCategories = [...new Set(allExpenseCategories)];

  // Budgets for the selected month
  const monthBudgets = useMemo(
    () => (budgets ?? []).filter((b) => b.month === selectedMonth),
    [budgets, selectedMonth],
  );

  // Previous month for rollover calculation
  const prevMonthKey = getPreviousBudgetMonthKey(selectedMonth, startDay);

  // Expense totals by category for the selected month using budget month range
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    const { start, end } = getBudgetMonthRange(selectedMonth, startDay);

    for (const tx of transactions ?? []) {
      if (tx.type !== "EXPENSE") continue;
      const txDate = new Date(tx.date);
      if (txDate >= start && txDate <= end) {
        const current = map.get(tx.category) || 0;
        map.set(tx.category, current + tx.amount);
      }
    }
    return map;
  }, [transactions, selectedMonth, startDay]);

  // Previous month expense totals for rollover calculation
  const prevExpenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    const { start, end } = getBudgetMonthRange(prevMonthKey, startDay);

    for (const tx of transactions ?? []) {
      if (tx.type !== "EXPENSE") continue;
      const txDate = new Date(tx.date);
      if (txDate >= start && txDate <= end) {
        const current = map.get(tx.category) || 0;
        map.set(tx.category, current + tx.amount);
      }
    }
    return map;
  }, [transactions, prevMonthKey, startDay]);

  // Previous month budgets
  const prevMonthBudgets = useMemo(
    () => (budgets ?? []).filter((b) => b.month === prevMonthKey),
    [budgets, prevMonthKey],
  );

  // Combine budgets with actual spending and rollover
  const budgetWithSpending = useMemo(() => {
    return monthBudgets.map((b) => {
      // Calculate rollover from previous month (respecting toggle and cap)
      const prevBudget = prevMonthBudgets.find(
        (pb) => pb.categoryName === b.categoryName,
      );
      const prevSpent = prevExpenseByCategory.get(b.categoryName) || 0;

      let rollover = 0;
      if (b.rolloverEnabled && prevBudget) {
        const rawRollover = Math.max(0, prevBudget.amount - prevSpent);
        rollover =
          b.rolloverCap != null
            ? Math.min(rawRollover, b.rolloverCap)
            : rawRollover;
      }

      const effectiveAmount = b.amount + rollover;
      const spent = expenseByCategory.get(b.categoryName) || 0;
      const remaining = effectiveAmount - spent;

      return {
        ...b,
        amount: b.amount,
        spent,
        remaining,
        rollover,
        effectiveAmount,
        rolloverEnabled: b.rolloverEnabled,
        rolloverCap: b.rolloverCap,
        percentUsed:
          effectiveAmount > 0
            ? Math.min(100, (spent / effectiveAmount) * 100)
            : 0,
      };
    });
  }, [
    monthBudgets,
    prevMonthBudgets,
    expenseByCategory,
    prevExpenseByCategory,
  ]);

  const totalBudgeted = monthBudgets.reduce((s, b) => s + b.amount, 0);
  const totalRollover = budgetWithSpending.reduce((s, b) => s + b.rollover, 0);
  const totalEffective = budgetWithSpending.reduce(
    (s, b) => s + b.effectiveAmount,
    0,
  );
  const totalSpent = budgetWithSpending.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalEffective - totalSpent;

  // Categories without budgets
  const categoriesWithoutBudget = uniqueCategories.filter(
    (cat) => !monthBudgets.some((b) => b.categoryName === cat),
  );

  // Rollover history data
  const { data: rolloverHistory, isLoading: historyLoading } = useQuery<any>({
    queryKey: ["rollover-history"],
    queryFn: async () => {
      const res = await fetch("/api/budgets/rollover-history");
      if (!res.ok) throw new Error("Failed to fetch rollover history");
      return res.json();
    },
  });

  // Pie chart data for budget breakdown
  const pieData = budgetWithSpending
    .filter((b) => b.amount > 0)
    .map((b, i) => ({
      name: b.categoryName.replace("_", " "),
      value: b.amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Set monthly spending limits for each expense category
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, index) => (
                <SelectItem key={`${m}-${index}`} value={m}>
                  {getBudgetMonthLabel(m, startDay)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => resetForm()}
                disabled={
                  categoriesWithoutBudget.length === 0 && !editingBudget
                }
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingBudget ? "Edit Budget" : "Add Budget"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={formSubmit(onFormSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Controller
                    name="categoryName"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        required
                        disabled={!!editingBudget}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {(editingBudget
                            ? [editingBudget.categoryName]
                            : categoriesWithoutBudget
                          ).map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FormError errors={errors} name="categoryName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Monthly Budget (Rp)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    placeholder="1000000"
                    {...register("amount", { required: true })}
                  />
                  <FormError errors={errors} name="amount" />
                </div>

                {/* Rollover toggle */}
                <Controller
                  name="rolloverEnabled"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="rollover" className="text-sm font-medium">
                          Rollover unused budget
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Carry unused amount to next month
                        </p>
                      </div>
                      <Switch
                        id="rollover"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />

                {/* Rollover cap */}
                {formRolloverEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="rolloverCap">
                      Max Rollover (Rp){" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="rolloverCap"
                      type="number"
                      min="0"
                      placeholder="No limit"
                      {...register("rolloverCap")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum amount that can roll over. Leave empty for no
                      limit.
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  {editingBudget ? "Update" : "Add"} Budget
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(totalBudgeted)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {getBudgetMonthLabel(selectedMonth, startDay)}
            </p>
          </CardContent>
        </Card>
        {totalRollover > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Rollover
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatIDR(totalRollover)}
              </div>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                Unused from previous month
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Effective Total
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalEffective > totalBudgeted
                ? formatIDR(totalEffective)
                : formatIDR(totalBudgeted)}
            </div>
            {totalRollover > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Budget + {formatCompactIDR(totalRollover)} rollover
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalRemaining >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatIDR(Math.abs(totalRemaining))}
            </div>
            <Badge
              variant={totalRemaining >= 0 ? "profit" : "loss"}
              className="mt-1"
            >
              {totalRemaining >= 0 ? "Under Budget" : "Over Budget"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Budget Breakdown Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Budget Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: any, name: any) => [
                      formatIDR(Number(value)),
                      name,
                    ]}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {entry.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rollover History */}
      {(historyLoading || rolloverHistory?.categories?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Rollover History
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              How unused budget rolled over month to month for each category
            </p>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-muted-foreground py-2 pr-4 sticky left-0 bg-background">
                        Category
                      </th>
                      {rolloverHistory.months
                        .filter((m: any) =>
                          rolloverHistory.categories.some((c: any) =>
                            c.months.some((me: any) => me.month === m.key),
                          ),
                        )
                        .map((m: any) => (
                          <th
                            key={m.key}
                            className="text-right font-medium text-muted-foreground py-2 px-2 min-w-[80px]"
                          >
                            {m.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rolloverHistory.categories.map((cat: any) => (
                      <tr
                        key={cat.categoryName}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-2.5 pr-4 font-medium sticky left-0 bg-background">
                          {cat.categoryName}
                        </td>
                        {rolloverHistory.months
                          .filter((m: any) =>
                            cat.months.some((me: any) => me.month === m.key),
                          )
                          .map((m: any) => {
                            const entry = cat.months.find(
                              (me: any) => me.month === m.key,
                            );
                            if (!entry)
                              return (
                                <td
                                  key={m.key}
                                  className="py-2.5 px-2 text-right text-muted-foreground"
                                >
                                  —
                                </td>
                              );

                            return (
                              <td
                                key={m.key}
                                className="py-2.5 px-2 text-right"
                              >
                                {entry.rolloverReceived > 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    +{formatCompactIDR(entry.rolloverReceived)}
                                  </span>
                                ) : !entry.rolloverEnabled ? (
                                  <span className="text-muted-foreground">
                                    Off
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatCompactIDR(entry.unused)} unused
                                </div>
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Budget List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Budget Details{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({getBudgetMonthLabel(selectedMonth, startDay)})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {budgetsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          ) : budgetWithSpending.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                No budgets set for {getBudgetMonthLabel(selectedMonth, startDay)}
              </p>
              <p className="text-xs text-muted-foreground">
                Click "Add Budget" to set spending limits for your expense
                categories.
              </p>
            </div>
          ) : (
            budgetWithSpending.map((b) => {
              const isOverBudget = b.spent > b.effectiveAmount;
              const isNearLimit = b.percentUsed >= 80 && !isOverBudget;

              return (
                <div
                  key={b.id}
                  className="rounded-lg border p-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="text-sm font-medium">
                        {b.categoryName.replace("_", " ")}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1">
                      {b.rollover > 0 && (
                        <Badge variant="profit" className="text-[10px] leading-none">
                          +{formatCompactIDR(b.rollover)} rollover
                        </Badge>
                      )}
                      {!b.rolloverEnabled && (
                        <Badge variant="secondary" className="text-[10px] leading-none">
                          No rollover
                        </Badge>
                      )}
                      {b.rolloverEnabled && b.rolloverCap != null && (
                        <Badge variant="secondary" className="text-[10px] leading-none">
                          Cap: {formatCompactIDR(b.rolloverCap)}
                        </Badge>
                      )}
                      {isOverBudget && (
                        <Badge variant="loss" className="text-[10px] leading-none">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          Over
                        </Badge>
                      )}
                      {isNearLimit && !isOverBudget && (
                        <Badge variant="secondary" className="text-[10px] leading-none">
                          Near Limit
                        </Badge>
                      )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(b)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm("Delete this budget?")) {
                            deleteMutation.mutate(b.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Budget breakdown */}
                  <div className="text-xs text-muted-foreground mb-1.5 space-x-2">
                    <span>Budget: {formatIDR(b.amount)}</span>
                    {b.rollover > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        + {formatCompactIDR(b.rollover)} rollover
                      </span>
                    )}
                    <span className="font-medium">
                      = {formatIDR(b.effectiveAmount)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatIDR(b.spent)} spent of{" "}
                        {formatIDR(b.effectiveAmount)}
                      </span>
                      <span>{Math.round(b.percentUsed)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOverBudget
                            ? "bg-red-500"
                            : isNearLimit
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {isOverBudget
                          ? `${formatIDR(b.spent - b.effectiveAmount)} over`
                          : `${formatIDR(b.remaining)} remaining`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
