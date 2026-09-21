"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionFormSchema } from "@/lib/validation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  Search,
  Loader2,
  Filter,
  Download,
  FileUp,
  Home,
  Sparkles,
  PiggyBank,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatIDR, formatDate, type PaginatedResponse } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { FormError } from "@/components/ui/form-error";
import {
  RULE_TYPES,
  RULE_TYPE_ORDER,
  RULE_TYPE_CONFIGS,
  OTHER_CONFIG,
} from "@/lib/rule-type";
import { toast } from "sonner";
import {
  TransactionFormData,
  TransactionInterface,
  TransactionSummary,
} from "@/types/transaction";
import {
  generateBudgetMonths,
  getCurrentBudgetMonthKey,
  getBudgetMonthLabel,
} from "@/lib/budget-months";
import { getBudgetAlert } from "@/lib/helper/transaction";
import {
  PREDEFINED_EXPENSE,
  PREDEFINED_INCOME,
  TRANSACTION_TYPES,
} from "@/const/transaction";
import TransactionSkeleton from "@/components/dashboard/transaction/skeleton";

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [ruleFilter, setRuleFilter] = useState<string>("ALL");
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionInterface | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input (300ms) before sending to server
  const debouncedSetSearch = useCallback((value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1); // Reset page when search changes
    }, 300);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Reset page when type filter changes
  const handleTypeFilterChange = useCallback((value: string) => {
    setTypeFilter(value);
    setPage(1);
  }, []);

  // Reset page when rule filter changes
  const handleRuleFilterChange = useCallback((value: string) => {
    setRuleFilter(value);
    setPage(1);
  }, []);

  // Reset page when the month filter changes
  const handleMonthChange = useCallback((value: string) => {
    setPickedMonth(value);
    setPage(1);
  }, []);

  const { data: budgetSettings } = useQuery<{ budgetStartDay: number }>({
    queryKey: ["budget-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/budget-settings");
      if (!res.ok) throw new Error("Failed to fetch budget settings");
      return res.json();
    },
  });
  const startDay = budgetSettings?.budgetStartDay ?? 1;

  // Selected month falls back to the current budget month once settings load.
  const currentMonthKey = useMemo(
    () => getCurrentBudgetMonthKey(startDay),
    [startDay],
  );
  const selectedMonth = pickedMonth ?? currentMonthKey;
  const months = useMemo(() => generateBudgetMonths(12, startDay), [startDay]);

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "EXPENSE",
      category: "",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const formType = watch("type");

  const { data: transactions, isLoading } = useQuery({
    queryKey: [
      "transactions",
      page,
      debouncedSearch,
      typeFilter,
      selectedMonth,
      ruleFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "50",
        month: selectedMonth,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (ruleFilter !== "ALL") params.set("rule", ruleFilter);
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const json: PaginatedResponse<
        TransactionInterface,
        TransactionSummary
      > = await res.json();
      return json;
    },
  });

  const transactionList = transactions?.data ?? [];
  const pagination = transactions?.pagination;
  const summary = transactions?.summary;

  // Full-month spend per category for the CURRENT budget month (unfiltered and
  // unpaginated) so budget alerts below count every transaction, not just the
  // page/filters currently on screen.
  const { data: monthSpending } = useQuery<Record<string, number>>({
    queryKey: ["transactions", "month-spending", currentMonthKey],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "1",
        month: currentMonthKey,
        type: "EXPENSE",
        summaryByCategory: "1",
      });
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch month spending");
      const json: PaginatedResponse<TransactionInterface, TransactionSummary> =
        await res.json();
      return json.summary?.byCategory ?? {};
    },
  });

  const spentByCategory = useMemo(
    () => new Map(Object.entries(monthSpending ?? {})),
    [monthSpending],
  );

  const { data: customCategories } = useQuery<
    Array<{
      id: string;
      name: string;
      type: string;
      color: string;
      ruleType: string | null;
    }>
  >({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  // Carry-over-adjusted effective budgets for the current month, computed by
  // the same endpoint the budgets page uses. The budget alert must compare
  // spending against the effective limit (budget + rollover) to match it.
  const { data: rolloverHistory } = useQuery<{
    categories: Array<{
      categoryKey: string;
      months: Array<{ month: string; effectiveBudget: number }>;
    }>;
  }>({
    queryKey: ["rollover-history"],
    queryFn: async () => {
      const res = await fetch("/api/budgets/rollover-history");
      if (!res.ok) throw new Error("Failed to fetch rollover history");
      return res.json();
    },
  });

  const effectiveBudgetByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of rolloverHistory?.categories ?? []) {
      const entry = cat.months?.find((m) => m.month === currentMonthKey);
      if (entry) map.set(cat.categoryKey, entry.effectiveBudget);
    }
    return map;
  }, [rolloverHistory, currentMonthKey]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to add transaction" }));
        throw new Error(err.error || "Failed to add transaction");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rollover-history"] });
      toast.success("Transaction added");

      // Check budget alert for expense transactions
      if (variables.type === "EXPENSE" && monthSpending) {
        const alert = getBudgetAlert(
          variables.category,
          parseFloat(variables.amount.toString()),
          effectiveBudgetByCategory.get(variables.category),
          spentByCategory,
        );
        if (alert.level === "over") {
          toast.error(alert.message, { duration: 6000 });
        } else if (alert.level === "near") {
          toast.warning(alert.message, { duration: 5000 });
        }
      }

      resetForm();
    },
    onError: (err) => toast.error(err.message || "Failed to add transaction"),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/transactions/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to update transaction" }));
        throw new Error(err.error || "Failed to update transaction");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rollover-history"] });
      toast.success("Transaction updated");

      // Check budget alert for expense transactions
      if (variables.type === "EXPENSE" && monthSpending) {
        // The stored transaction is already counted in the month's spend, so
        // only the amount delta is added on top.
        const oldAmount = editingTransaction?.amount
          ? parseFloat(editingTransaction.amount.toString())
          : 0;
        const netAdditional =
          parseFloat(variables.amount.toString()) - oldAmount;
        const alert = getBudgetAlert(
          variables.category,
          netAdditional,
          effectiveBudgetByCategory.get(variables.category),
          spentByCategory,
        );
        if (alert.level === "over") {
          toast.error(alert.message, { duration: 6000 });
        } else if (alert.level === "near") {
          toast.warning(alert.message, { duration: 5000 });
        }
      }

      resetForm();
    },
    onError: (err) =>
      toast.error(err.message || "Failed to update transaction"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to delete transaction" }));
        throw new Error(err.error || "Failed to delete transaction");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Transaction deleted");
    },
    onError: (err) =>
      toast.error(err.message || "Failed to delete transaction"),
  });

  function resetForm() {
    setEditingTransaction(null);
    reset({
      type: "EXPENSE",
      category: "",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
    setIsDialogOpen(false);
  }

  function openEdit(tx: TransactionInterface) {
    setEditingTransaction(tx);
    reset({
      type: tx.type as "INCOME" | "EXPENSE",
      category: tx.category,
      amount: tx.amount.toString(),
      description: tx.description,
      date: new Date(tx.date).toISOString().split("T")[0],
    });
    setIsDialogOpen(true);
  }

  function onFormSubmit(data: TransactionFormData) {
    const payload = {
      type: data.type,
      category: data.category,
      amount: parseFloat(data.amount),
      description: data.description,
      date: new Date(data.date).toISOString(),
    };

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Build ruleType map: category name → ruleType
  const ruleTypeMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const cat of customCategories ?? []) {
      map.set(cat.name, cat.ruleType);
    }
    return map;
  }, [customCategories]);

  // Transactions are displayed chronologically; rule type is metadata on each row.
  const sortedTransactions = useMemo(
    () =>
      [...transactionList].sort(
        (a, b) => +new Date(b.date) - +new Date(a.date),
      ),
    [transactionList],
  );

  function getRuleType(category: string) {
    const value = ruleTypeMap.get(category);
    return value && RULE_TYPES.includes(value as any) ? value : "OTHER";
  }

  const groupedByType = useMemo(() => {
    const makeGroup = (txs: TransactionInterface[]) => ({
      NEED: { dateMap: new Map<string, TransactionInterface[]>(), total: 0 },
      WANT: { dateMap: new Map<string, TransactionInterface[]>(), total: 0 },
      SAVINGS: { dateMap: new Map<string, TransactionInterface[]>(), total: 0 },
      OTHER: {
        dateMap: new Map([["", txs]]),
        // Net cash flow: income adds, expenses subtract.
        total: txs.reduce(
          (sum, tx) => sum + (tx.type === "INCOME" ? tx.amount : -tx.amount),
          0,
        ),
      },
    });
    return {
      income: makeGroup(sortedTransactions),
      expenses: makeGroup([]),
    };
  }, [sortedTransactions]);

  // Totals come from the server summary so they cover every transaction in the
  // selected month/filters, not just the current page. Fall back to the loaded
  // page while the summary is still in flight.
  const totalIncome = useMemo(
    () =>
      summary?.totalIncome ??
      transactionList
        .filter((tx) => tx.type === "INCOME")
        .reduce((sum, tx) => sum + tx.amount, 0),
    [summary, transactionList],
  );

  const totalExpenses = useMemo(
    () =>
      summary?.totalExpenses ??
      transactionList
        .filter((tx) => tx.type === "EXPENSE")
        .reduce((sum, tx) => sum + tx.amount, 0),
    [summary, transactionList],
  );

  const categories = useMemo(() => {
    const userCats = (customCategories ?? [])
      .filter((c) => c.type === formType)
      .map((c) => c.name);
    const predefined =
      formType === "INCOME" ? PREDEFINED_INCOME : PREDEFINED_EXPENSE;
    return [
      ...predefined,
      ...userCats.filter((c) => !(predefined as readonly string[]).includes(c)),
    ];
  }, [customCategories, formType]);

  function renderRuleTypeGroup(
    groups: Record<
      string,
      { dateMap: Map<string, TransactionInterface[]>; total: number }
    >,
  ) {
    const RULE_TYPE_ICONS: Record<string, ReactNode> = {
      NEED: <Home className="h-3.5 w-3.5" />,
      WANT: <Sparkles className="h-3.5 w-3.5" />,
      SAVINGS: <PiggyBank className="h-3.5 w-3.5" />,
      OTHER: <Filter className="h-3.5 w-3.5" />,
    };


    return (
      <div className="space-y-4">
        {["OTHER"].map((ruleType) => {
          const group = groups[ruleType];
          if (group.dateMap.size === 0) return null;
          const isOther = ruleType === "OTHER";
          const config = isOther
            ? { ...OTHER_CONFIG, label: "Transactions" }
            : RULE_TYPE_CONFIGS[ruleType];
          const icon = isOther
            ? RULE_TYPE_ICONS.OTHER
            : RULE_TYPE_ICONS[ruleType];
          const colorName = isOther ? "gray" : ruleType.toLowerCase();
          const textColor = config.color;
          const borderColor = `border-${colorName}-500/10`;
          const bgColor = `bg-${colorName}-500/[0.02]`;
          const hoverBg = `hover:bg-${colorName}-500/[0.05]`;

          return (
            <div key={ruleType} className="ml-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <span className={textColor}>{icon}</span>
                  <span className={textColor}>{config.label}</span>
                </h4>
                <span
                  className={`text-xs font-medium ${
                    group.total < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {group.total < 0 ? "-" : "+"}
                  {formatIDR(Math.abs(group.total))}
                </span>
              </div>
              <div className="space-y-3">
                {Array.from(group.dateMap.entries()).map(([dateLabel, txs]) => (
                  <div key={dateLabel}>
                    {dateLabel && (
                      <h5 className="text-[11px] font-medium text-muted-foreground mb-1.5 px-1">
                        {dateLabel}
                      </h5>
                    )}
                    <div className="space-y-1">
                      {txs.map((tx) => {
                        // Income adds to the balance (+), expenses subtract (-).
                        const isIncome = tx.type === "INCOME";
                        const itemSign = isIncome ? "+" : "-";
                        const itemAmountColor = isIncome
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400";
                        const ruleType = getRuleType(tx.category);
                        const ruleConfig =
                          ruleType === "OTHER"
                            ? OTHER_CONFIG
                            : RULE_TYPE_CONFIGS[ruleType];

                        return (
                        <div
                          key={tx.id}
                          className={`flex items-start gap-3 rounded-lg border ${borderColor} ${bgColor} ${hoverBg} p-3 transition-colors group`}
                        >
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgColor} ${textColor}`}
                          >
                            {icon}
                          </div>

                          {/* Description + amount share the first line; the meta
                              row wraps underneath instead of overflowing on
                              narrow (mobile) widths. */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium">
                                {tx.description}
                              </p>
                              <span
                                className={`shrink-0 text-sm font-semibold tabular-nums ${itemAmountColor}`}
                              >
                                {itemSign}
                                {formatIDR(tx.amount)}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="truncate">
                                {tx.category.replace("_", " ")}
                              </span>
                              <span aria-hidden="true">&bull;</span>
                              <span className="whitespace-nowrap">
                                {formatDate(tx.date)}
                              </span>
                              <span aria-hidden="true">&bull;</span>
                              <span
                                className={`whitespace-nowrap ${ruleConfig.color}`}
                              >
                                {ruleConfig.label}
                              </span>
                            </div>
                          </div>

                          {/* Actions get their own column so they never squeeze
                              the amount/description on small screens. */}
                          <div className="flex shrink-0 gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit(tx)}
                              className="min-w-9 min-h-9"
                              aria-label="Edit transaction"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                if (confirm("Delete this transaction?")) {
                                  deleteMutation.mutate(tx.id);
                                }
                              }}
                              className="min-w-9 min-h-9"
                              aria-label="Delete transaction"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Track your income and expenses
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Import button */}
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              id="csv-import"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const formData = new FormData();
                formData.append("file", file);

                toast.loading("Importing transactions...");
                try {
                  const res = await fetch("/api/transactions/import", {
                    method: "POST",
                    body: formData,
                  });
                  const result = await res.json();
                  toast.dismiss();

                  if (!res.ok) {
                    toast.error(result.error || "Import failed");
                    if (result.importErrors?.length > 0) {
                      console.error("Import errors:", result.importErrors);
                    }
                  } else {
                    toast.success(result.message);
                    queryClient.invalidateQueries({
                      queryKey: ["transactions"],
                    });
                    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                  }
                } catch {
                  toast.dismiss();
                  toast.error("Failed to import CSV");
                }
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("csv-import")?.click()}
              className="w-full sm:w-auto"
            >
              <FileUp className="h-4 w-4 mr-1" />
              Import
            </Button>
          </div>

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch("/api/transactions/export");
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Transactions exported");
              } catch {
                toast.error("Failed to export transactions");
              }
            }}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => resetForm()}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? "Edit Transaction" : "Add Transaction"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={formSubmit(onFormSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-2">
                      {TRANSACTION_TYPES.map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={field.value === t ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            field.onChange(t);
                            setValue("category", "");
                          }}
                          className="flex-1"
                        >
                          {t === "INCOME" ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          {t.charAt(0) + t.slice(1).toLowerCase()}
                        </Button>
                      ))}
                    </div>
                  )}
                />
                <FormError errors={errors} name="type" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (Rp)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  placeholder="100000"
                  {...register("amount", { required: true })}
                />
                <FormError errors={errors} name="amount" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="What was this for?"
                  {...register("description", { required: true })}
                />
                <FormError errors={errors} name="description" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date", { required: true })}
                />
                <FormError errors={errors} name="date" />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                {editingTransaction ? "Update" : "Add"} Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatIDR(totalIncome)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatIDR(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {formatIDR(totalIncome - totalExpenses)}
            </div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Totals for{" "}
        {selectedMonth === "ALL"
          ? "all time"
          : getBudgetMonthLabel(selectedMonth, startDay)}
      </p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              debouncedSetSearch(e.target.value);
            }}
          />
        </div>
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-full sm:w-40">
            <CalendarDays className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All time</SelectItem>
            {months.map((m, index) => (
              <SelectItem key={`${m}-${index}`} value={m}>
                {getBudgetMonthLabel(m, startDay)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
          <SelectTrigger className="w-full sm:w-36">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ruleFilter} onValueChange={handleRuleFilterChange}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All rules</SelectItem>
            {RULE_TYPES.map((r) => (
              <SelectItem key={r} value={r}>
                {RULE_TYPE_CONFIGS[r].label}
              </SelectItem>
            ))}
            <SelectItem value="OTHER">{OTHER_CONFIG.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction List */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TransactionSkeleton key={i} />
            ))
          ) : transactionList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || typeFilter !== "ALL" || ruleFilter !== "ALL"
                  ? "No transactions match your filters."
                  : "No transactions yet. Add your first one!"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Income Section */}
              {transactionList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-4 w-4" />
                      Transactions
                    </h3>
                    <span className="text-sm font-bold">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatIDR(totalIncome)}
                      </span>{" "}
                      /{" "}
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">
                        -{formatIDR(totalExpenses)}
                      </span>
                    </span>
                  </div>
                  {renderRuleTypeGroup(groupedByType.income)}
                </div>
              )}

              {/* Expense Section */}
              {false && totalExpenses > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                      <TrendingDown className="h-4 w-4" />
                      Expenses
                    </h3>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      -{formatIDR(totalExpenses)}
                    </span>
                  </div>
                  {renderRuleTypeGroup(groupedByType.expenses)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && (
        <Pagination
          pagination={pagination}
          page={page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
