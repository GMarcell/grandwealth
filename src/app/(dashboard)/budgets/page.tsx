"use client";

import { useState, useMemo, useEffect } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Wand2,
  CalendarRange,
  Sparkles,
  Lock,
  Unlock,
} from "lucide-react";
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
  DialogDescription,
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
import { formatCompactIDR, formatIDR } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-colors";
import {
  getCurrentBudgetMonthKey,
  getBudgetMonthLabel,
  generateBudgetMonths,
} from "@/lib/budget-months";
import {
  buildSpentByMonthCategory,
  computeCarryOverChain,
} from "@/lib/budget-carry-over";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiMutate, isQueuedResult } from "@/lib/api-mutate";
import dynamic from "next/dynamic";

// Dynamic import the budget allocation chart (ships recharts only when rendered)
const BudgetAllocationChart = dynamic(
  () => import("@/components/charts/budgets-chart").then((m) => m.BudgetAllocationChart),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    ),
  },
);

const RULE_TYPE_LABEL: Record<"NEED" | "WANT" | "SAVINGS", string> = {
  NEED: "Need",
  WANT: "Want",
  SAVINGS: "Savings",
};

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
  rolloverCap: number | null;
  canReduce: boolean;
}

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

type BudgetFormData = z.infer<typeof budgetFormSchema>;

type BudgetPayload = {
  categoryName: string;
  amount: number;
  month: string;
  rolloverCap: number | null;
  canReduce?: boolean;
};

/** Legacy unpaginated `/api/transactions` response (a plain array). */
type BudgetTransaction = {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
};

type RolloverMonth = { key: string; label: string };
type RolloverMonthEntry = {
  month: string;
  rolloverReceived: number;
  carryOverEnabled: boolean;
  unused: number;
};
type RolloverCategory = {
  categoryName: string;
  months: RolloverMonthEntry[];
};
type RolloverHistory = {
  months: RolloverMonth[];
  categories: RolloverCategory[];
};

type PlanBudget = {
  categoryName: string;
  amount: number;
  ruleType: "NEED" | "WANT" | "SAVINGS";
  spent: number;
};
type BudgetPlan = {
  month: string;
  sourceMonth: string;
  incomeMonth: string;
  summary: string;
  income: number;
  totalExpenses: number;
  totalBudgeted: number;
  budgets: PlanBudget[];
  skippedGroups: Array<"NEED" | "WANT" | "SAVINGS">;
};

// Admin-only AI plan shape (Groq).
type AiPlanBudget = {
  categoryName: string;
  amount: number;
  reason: string | null;
};
type AiPlan = {
  month: string;
  sourceMonth: string;
  summary: string;
  totalIncome: number;
  totalExpenses: number;
  totalBudgeted: number;
  budgets: AiPlanBudget[];
};


export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  // The Groq AI planner is a Pro+ feature (admins always have access);
  // everyone else uses the deterministic 50/30/20 planner. The API is the
  // authoritative gate — this is only the UI hint.
  const canUseAiPlanner =
    session?.user?.role === "ADMIN" || session?.user?.plan === "PRO_PLUS";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [quickAmounts, setQuickAmounts] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryName: "",
      amount: "",
      rolloverCap: "",
    },
  });

  const { data: budgetSettings } = useQuery<{
    budgetStartDay: number
    carryOverEnabled: boolean
  }>({
    queryKey: ["budget-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/budget-settings");
      if (!res.ok) throw new Error("Failed to fetch budget settings");
      return res.json();
    },
  });

  const startDay = budgetSettings?.budgetStartDay ?? 1;
  // Global carry-over setting controls rollover for every category.
  const carryOverEnabled = budgetSettings?.carryOverEnabled ?? true;

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

  const { data: transactions } = useQuery<BudgetTransaction[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BudgetPayload) =>
      apiMutate("/api/budgets", { method: "POST", body: data }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast[isQueuedResult(result) ? "info" : "success"](
        isQueuedResult(result)
          ? "Saved offline — will sync when you reconnect"
          : "Budget saved"
      );
      resetForm();
    },
    onError: (err) => toast.error(err.message || "Failed to save budget"),
  });

  const templateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/budgets/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      })
      const json = await res.json().catch(() => ({ error: "Failed to generate template" }))
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate template")
      }
      return json
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(data.message || "Budgets generated from the 50/30/20 rule");
      if (data.skippedGroups?.length > 0) {
        toast.info(
          `No ${data.skippedGroups.map((g: string) => g.toLowerCase()).join(", ")} categories classified yet — assign rule types in Settings`,
          { duration: 8000 }
        );
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to generate template"),
  });

  // Build a 50/30/20 plan from last month's existing data (preview only).
  const planMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/budgets/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate budget plan");
      }
      return json.plan as BudgetPlan;
    },
    onSuccess: (generated) => {
      setPlan(generated);
      setIsPlanDialogOpen(true);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to generate budget plan",
      ),
  });

  // Write the generated plan to this month's budgets.
  const applyPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/budgets/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth, apply: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to apply budget plan");
      }
      return json as { message?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(data.message || "Budget plan applied");
      setIsPlanDialogOpen(false);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to apply budget plan",
      ),
  });

  // Admin-only: ask Groq for a plan (preview only — nothing is written yet).
  const aiPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/budgets/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to generate AI budget plan");
      }
      return json.plan as AiPlan;
    },
    onSuccess: (generated) => setAiPlan(generated),
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to generate AI budget plan",
      ),
  });

  // Open the dialog immediately and let it show progress, rather than leaving
  // the user with no feedback while the plan is being generated.
  function openAiPlan() {
    setAiPlan(null)
    setIsAiDialogOpen(true)
    aiPlanMutation.mutate()
  }

  // Admin-only: write the AI plan to this month's budgets.
  const aiApplyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/budgets/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth, apply: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to apply AI budget plan");
      }
      return json as { message?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(data.message || "AI budget plan applied");
      setIsAiDialogOpen(false);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to apply AI budget plan",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiMutate(`/api/budgets/${id}`, { method: "DELETE" }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast[isQueuedResult(result) ? "info" : "success"](
        isQueuedResult(result)
          ? "Deleted offline — will sync when you reconnect"
          : "Budget deleted"
      );
    },
    onError: (err) => toast.error(err.message || "Failed to delete budget"),
  });

  function resetForm() {
    setEditingBudget(null);
    reset({
      categoryName: "",
      amount: "",
      rolloverCap: "",
    });
    setIsDialogOpen(false);
  }

  function openEdit(budget: Budget) {
    setEditingBudget(budget);
    reset({
      categoryName: budget.categoryName,
      amount: budget.amount.toString(),
      rolloverCap: budget.rolloverCap != null ? budget.rolloverCap.toString() : "",
    });
    setIsDialogOpen(true);
  }

  function onFormSubmit(data: BudgetFormData) {
    createMutation.mutate({
      categoryName: data.categoryName,
      amount: parseFloat(data.amount),
      month: selectedMonth,
      rolloverCap: data.rolloverCap ? parseFloat(data.rolloverCap) : null,
      canReduce: data.canReduce ?? true,
    });
  }

  // Toggle whether AI can reduce this budget
  function toggleCanReduce(budget: Budget) {
    type BudgetUpdateResult = { canReduce: boolean } | { error: string }
    apiMutate<BudgetUpdateResult>(`/api/budgets/${budget.id}`, {
      method: "PATCH",
      body: { canReduce: !budget.canReduce },
    }).then((result) => {
      if ("error" in result) {
        toast.error(result.error || "Failed to update budget");
      } else if ("queued" in result) {
        toast.info("Saved offline — will sync when you reconnect");
      } else {
        toast.success(
          result.canReduce
            ? `AI can now reduce ${budget.categoryName} budget`
            : `Locked ${budget.categoryName} budget - AI cannot reduce it`,
        );
        queryClient.invalidateQueries({ queryKey: ["budgets"] });
      }
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

  useEffect(() => {
    setQuickAmounts(
      Object.fromEntries(monthBudgets.map((budget) => [budget.categoryName, String(budget.amount)])),
    );
  }, [monthBudgets]);

  function saveQuickBudget(categoryName: string) {
    const amount = Number(quickAmounts[categoryName] || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid budget amount");
      return;
    }
    const existing = monthBudgets.find((budget) => budget.categoryName === categoryName);
    createMutation.mutate({
      categoryName,
      amount,
      month: selectedMonth,
      rolloverCap: existing?.rolloverCap ?? null,
    });
  }

  function formatCategoryName(category: string) {
    return category
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Expense totals grouped by budget month + category.
  const spentByMonthCategory = useMemo(
    () => buildSpentByMonthCategory(transactions ?? [], startDay),
    [transactions, startDay],
  );

  // Every budget month from the earliest one up to the selected month. The
  // whole chain is needed so carry-over can COMPOUND month over month.
  const chainMonths = useMemo(() => {
    const months = new Set((budgets ?? []).map((b) => b.month));
    months.add(selectedMonth);
    return [...months].filter((m) => m <= selectedMonth).sort();
  }, [budgets, selectedMonth]);

  // Compounded carry-over for every month/category in the chain.
  const carryOverChain = useMemo(
    () =>
      computeCarryOverChain({
        months: chainMonths,
        budgets: budgets ?? [],
        spentByMonthCategory,
        carryOverEnabled,
      }),
    [chainMonths, budgets, spentByMonthCategory, carryOverEnabled],
  );

  // Combine the selected month's budgets with spending and carry-over.
  const budgetWithSpending = useMemo(() => {
    const entries = carryOverChain.get(selectedMonth);

    return monthBudgets.map((b) => {
      const entry = entries?.get(b.categoryName);
      const rollover = entry?.rollover ?? 0;
      const effectiveAmount = entry?.effectiveAmount ?? b.amount;
      const spent = entry?.spent ?? 0;
      const remaining = effectiveAmount - spent;

      return {
        ...b,
        amount: b.amount,
        spent,
        remaining,
        rollover,
        effectiveAmount,
        // Reflect the global carry-over switch so the badges match what's
        // actually applied.
        carryOverEnabled,
        rolloverCap: b.rolloverCap,
        percentUsed:
          effectiveAmount > 0
            ? Math.min(100, (spent / effectiveAmount) * 100)
            : 0,
      };
    });
  }, [monthBudgets, carryOverChain, selectedMonth, carryOverEnabled]);

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
  const { data: rolloverHistory, isLoading: historyLoading } = useQuery<RolloverHistory>({
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
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
            <p className="text-sm text-muted-foreground">
              Set monthly spending limits for each expense category
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => resetForm()}
                disabled={
                  categoriesWithoutBudget.length === 0 && !editingBudget
                }
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

                {/* Rollover cap — carry-over itself is toggled globally in
                    Settings ("Carry over unused budget"). */}
                {carryOverEnabled && (
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
                    </p>                   </div>
                 )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="canReduce"
                    className="h-4 w-4 rounded border-muted-foreground accent-emerald-500"
                    {...register("canReduce")}
                  />
                  <Label htmlFor="canReduce" className="text-sm">
                    Allow AI to reduce this budget
                  </Label>
                </div>

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

        {/* Action bar - responsive stack on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[160px]">
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
          {canUseAiPlanner ? (
            <Button
              size="sm"
              variant="outline"
              onClick={openAiPlan}
              disabled={aiPlanMutation.isPending || aiApplyMutation.isPending}
              title="Pro+ feature: let AI plan this month's budget from last month's actual spending"
            >
              {aiPlanMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              AI Plan
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/upgrade")}
              className="text-muted-foreground"
              title="AI budget planning is a Pro+ feature — see what's included"
            >
              <Lock className="h-4 w-4 mr-1" />
              AI Plan · Pro+
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => planMutation.mutate()}
            disabled={planMutation.isPending || applyPlanMutation.isPending}
            title="Build this month's budget from last month's spending using the 50/30/20 rule"
          >
            {planMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CalendarRange className="h-4 w-4 mr-1" />
            )}
            Plan Last Month
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => templateMutation.mutate()}
            disabled={templateMutation.isPending}
            title="Auto-generate budgets for this month using the 50/30/20 rule based on your income and category classifications"
          >
            {templateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Wand2 className="h-4 w-4 mr-1" />
            )}
            50/30/20
          </Button>
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

      {/* Budget Breakdown Chart — dynamically loaded */}
      {pieData.length > 0 && (
        <div className="overflow-hidden">
          <BudgetAllocationChart data={pieData} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Adjust Category Budgets</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set or update the budget for every expense category in this budget period.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {uniqueCategories.map((category) => {
            const existingBudget = monthBudgets.find((b) => b.categoryName === category);
            const canReduce = existingBudget?.canReduce ?? true;
            return (
              <div key={category} className="rounded-lg border p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`quick-${category}`} className="truncate text-xs">
                      {formatCategoryName(category)}
                    </Label>
                    <button
                      type="button"
                      className={`text-xs flex items-center gap-1 shrink-0 ${canReduce ? "text-muted-foreground" : "text-primary"}`}
                      onClick={() => toggleCanReduce(existingBudget!)}
                      title={canReduce ? "Click to lock - AI cannot reduce" : "Click to unlock - AI can reduce"}
                    >
                      {canReduce ? (
                        <><Unlock className="h-3 w-3" /> Open</>
                      ) : (
                        <><Lock className="h-3 w-3" /> Fixed</>
                      )}
                    </button>
                  </div>
                  <Input
                    id={`quick-${category}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={quickAmounts[category] ?? ""}
                    onChange={(event) => setQuickAmounts((current) => ({ ...current, [category]: event.target.value }))}
                    className="w-full"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-muted-foreground">
                    Spent:{" "}
                    {formatIDR(
                      spentByMonthCategory.get(selectedMonth)?.get(category) ?? 0,
                    )}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => saveQuickBudget(category)} disabled={createMutation.isPending} className="shrink-0">
                    Save
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Rollover History */}
      {(historyLoading || (rolloverHistory?.categories.length ?? 0) > 0) && (
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
            ) : rolloverHistory ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0 sm:overflow-visible">
                <table className="w-full text-xs min-w-[400px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-muted-foreground py-2 pr-4 sticky left-0 bg-background">
                        Category
                      </th>
                      {rolloverHistory.months
                        .filter((m) =>
                          rolloverHistory.categories.some((c) =>
                            c.months.some((me) => me.month === m.key),
                          ),
                        )
                        .map((m) => (
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
                    {rolloverHistory.categories.map((cat) => (
                      <tr
                        key={cat.categoryName}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-2.5 pr-4 font-medium sticky left-0 bg-background">
                          {cat.categoryName}
                        </td>
                        {rolloverHistory.months
                          .filter((m) =>
                            cat.months.some((me) => me.month === m.key),
                          )
                          .map((m) => {
                            const entry = cat.months.find(
                              (me) => me.month === m.key,
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
                                ) : !entry.carryOverEnabled ? (
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
            ) : null}
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
                  <div className="flex items-start sm:items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <h4 className="text-sm font-medium truncate">
                        {b.categoryName.replace("_", " ")}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1">
                      {b.rollover > 0 && (
                        <Badge variant="profit" className="text-[10px] leading-none">
                          +{formatCompactIDR(b.rollover)} rollover
                        </Badge>
                      )}
                      {!b.carryOverEnabled && (
                        <Badge variant="secondary" className="text-[10px] leading-none">
                          No rollover
                        </Badge>
                      )}
                      {b.carryOverEnabled && b.rolloverCap != null && (
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
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(b)}
                        aria-label="Edit budget"
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
                        aria-label="Delete budget"
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

      {/* Pro+ AI plan preview (Groq) — review before applying */}
      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Budget Plan
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {aiPlan
              ? `Built from your spending in ${getBudgetMonthLabel(aiPlan.sourceMonth, startDay)}. Review it before applying — nothing is saved until you press Apply.`
              : "AI builds a budget from your last completed month of spending. Nothing is saved until you apply it."}
          </DialogDescription>

          {aiPlanMutation.isPending && (
            <div className="space-y-3" role="status" aria-live="polite">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing last month&apos;s spending…
              </p>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!aiPlanMutation.isPending && aiPlanMutation.isError && (
            <div
              role="alert"
              className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
            >
              <p className="text-sm">
                {aiPlanMutation.error instanceof Error
                  ? aiPlanMutation.error.message
                  : "Couldn't generate a plan. Please try again."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => aiPlanMutation.mutate()}
              >
                Try again
              </Button>
            </div>
          )}

          {!aiPlanMutation.isPending && aiPlan && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {aiPlan.summary ||
                  `Proposed budget for ${getBudgetMonthLabel(selectedMonth, startDay)}.`}
              </p>

              <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {aiPlan.budgets.map((b) => (
                  <div
                    key={b.categoryName}
                    className="flex items-start justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {formatCategoryName(b.categoryName)}
                      </div>
                      {b.reason && (
                        <div className="text-xs text-muted-foreground">
                          {b.reason}
                        </div>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-sm font-semibold">
                      {formatIDR(b.amount)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total proposed</span>
                <span className="font-bold">{formatIDR(aiPlan.totalBudgeted)}</span>
              </div>
              {aiPlan.totalIncome > 0 && aiPlan.totalBudgeted > aiPlan.totalIncome && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Proposed total exceeds last month&apos;s income of{" "}
                  {formatIDR(aiPlan.totalIncome)}.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => aiPlanMutation.mutate()}
                  disabled={aiPlanMutation.isPending || aiApplyMutation.isPending}
                >
                  {aiPlanMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Regenerate
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => aiApplyMutation.mutate()}
                  disabled={aiApplyMutation.isPending || aiPlanMutation.isPending}
                >
                  {aiApplyMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Apply to {getBudgetMonthLabel(selectedMonth, startDay)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 50/30/20 plan preview — review before applying */}
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              Budget Plan for {getBudgetMonthLabel(selectedMonth, startDay)}
            </DialogTitle>
          </DialogHeader>
          {plan && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{plan.summary}</p>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Income base</div>
                  <div className="font-semibold">{formatIDR(plan.income)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {getBudgetMonthLabel(plan.incomeMonth, startDay)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">
                    Last month spent
                  </div>
                  <div className="font-semibold">{formatIDR(plan.totalExpenses)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {getBudgetMonthLabel(plan.sourceMonth, startDay)}
                  </div>
                </div>
              </div>

              <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {plan.budgets.map((b) => (
                  <div
                    key={b.categoryName}
                    className="flex items-start justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">
                          {formatCategoryName(b.categoryName)}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] leading-none"
                        >
                          {RULE_TYPE_LABEL[b.ruleType]}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Spent last month: {formatIDR(b.spent)}
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-sm font-semibold">
                      {formatIDR(b.amount)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total proposed</span>
                <span className="font-bold">{formatIDR(plan.totalBudgeted)}</span>
              </div>

              {plan.skippedGroups.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Some 50/30/20 groups are unallocated because no{" "}
                  {plan.skippedGroups
                    .map((g) => RULE_TYPE_LABEL[g].toLowerCase())
                    .join(" or ")}{" "}
                  category had spending last month. Classify categories in
                  Settings.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => planMutation.mutate()}
                  disabled={planMutation.isPending || applyPlanMutation.isPending}
                >
                  {planMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Recalculate
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => applyPlanMutation.mutate()}
                  disabled={applyPlanMutation.isPending || planMutation.isPending}
                >
                  {applyPlanMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Apply to {getBudgetMonthLabel(selectedMonth, startDay)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
