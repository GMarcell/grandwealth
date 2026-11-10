"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { budgetFormSchema } from "@/lib/validation"
import { CHART_COLORS } from "@/lib/chart-colors"
import {
  getCurrentBudgetMonthKey,
  generateBudgetMonths,
} from "@/lib/budget-months"
import { computeCarryOverChain } from "@/lib/budget-carry-over"
import { apiMutate, isQueuedResult } from "@/lib/api-mutate"
import { apiGet } from "@/lib/api-get"
import {
  EXPENSE_CATEGORIES,
  type AiPlan,
  type Budget,
  type BudgetFormData,
  type BudgetPayload,
  type BudgetPlan,
  type Category,
  type RolloverHistory,
  type SpentByMonth,
} from "./types"

/**
 * Data layer for the budgets page: queries, mutations, carry-over maths and the
 * budget form. The page component keeps only rendering and dialog markup.
 */
export function useBudgets() {
  const queryClient = useQueryClient();
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
    queryFn: () =>
      apiGet<{ budgetStartDay: number; carryOverEnabled: boolean }>(
        "/api/user/budget-settings",
      ),
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
    queryFn: () => apiGet<Budget[]>("/api/budgets"),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiGet<Category[]>("/api/categories"),
  });

  // Spend per budget month, aggregated server-side. Fetching the raw
  // transaction list here downloaded the account's whole history on every
  // visit just to re-add it up in the browser.
  const { data: spentByMonth } = useQuery<SpentByMonth>({
    queryKey: ["spent-by-month"],
    queryFn: () => apiGet<SpentByMonth>("/api/budgets/spent-by-month"),
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
  const spentByMonthCategory = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const [month, byCategory] of Object.entries(
      spentByMonth?.spentByMonthCategory ?? {},
    )) {
      map.set(month, new Map(Object.entries(byCategory)));
    }
    return map;
  }, [spentByMonth]);

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
    queryFn: () => apiGet<RolloverHistory>("/api/budgets/rollover-history"),
  });

  // Pie chart data for budget breakdown
  const pieData = budgetWithSpending
    .filter((b) => b.amount > 0)
    .map((b, i) => ({
      name: b.categoryName.replace("_", " "),
      value: b.amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));


  return {
    canUseAiPlanner,
    isDialogOpen,
    setIsDialogOpen,
    editingBudget,
    setEditingBudget,
    quickAmounts,
    setQuickAmounts,
    plan,
    setPlan,
    isPlanDialogOpen,
    setIsPlanDialogOpen,
    aiPlan,
    setAiPlan,
    isAiDialogOpen,
    setIsAiDialogOpen,
    register,
    formSubmit,
    control,
    reset,
    errors,
    budgetSettings,
    startDay,
    carryOverEnabled,
    currentMonthKey,
    selectedMonth,
    setSelectedMonth,
    MONTHS,
    budgets,
    budgetsLoading,
    categories,
    spentByMonth,
    createMutation,
    templateMutation,
    planMutation,
    applyPlanMutation,
    aiPlanMutation,
    aiApplyMutation,
    openAiPlan,
    deleteMutation,
    resetForm,
    openEdit,
    onFormSubmit,
    toggleCanReduce,
    uniqueCategories,
    monthBudgets,
    saveQuickBudget,
    formatCategoryName,
    spentByMonthCategory,
    chainMonths,
    carryOverChain,
    budgetWithSpending,
    totalBudgeted,
    totalRollover,
    totalEffective,
    totalSpent,
    totalRemaining,
    categoriesWithoutBudget,
    rolloverHistory,
    historyLoading,
    pieData,
  }
}
