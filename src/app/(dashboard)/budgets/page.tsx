"use client"

import dynamic from "next/dynamic"
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FormError, fieldErrorProps } from "@/components/ui/form-error"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCompactIDR, formatIDR } from "@/lib/utils"
import { Controller } from "react-hook-form"
import { useRouter } from "next/navigation"
import { getBudgetMonthLabel } from "@/lib/budget-months"
import { RULE_TYPE_LABEL } from "./types"
import { useBudgets } from "./use-budgets"

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
)

export default function BudgetsPage() {
  const router = useRouter();

  const {
    canUseAiPlanner,
    isDialogOpen,
    setIsDialogOpen,
    editingBudget,
    quickAmounts,
    setQuickAmounts,
    plan,
    isPlanDialogOpen,
    setIsPlanDialogOpen,
    aiPlan,
    isAiDialogOpen,
    setIsAiDialogOpen,
    register,
    formSubmit,
    control,
    errors,
    startDay,
    carryOverEnabled,
    selectedMonth,
    setSelectedMonth,
    MONTHS,
    budgetsLoading,
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
    budgetWithSpending,
    totalBudgeted,
    totalRollover,
    totalEffective,
    totalRemaining,
    categoriesWithoutBudget,
    rolloverHistory,
    historyLoading,
    pieData,
  } = useBudgets();

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
                        <SelectTrigger
                          {...fieldErrorProps(errors, "categoryName")}
                        >
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
                    type="text"
                    inputMode="numeric"
                    placeholder="1000000"
                    delimiters="period"
                    {...fieldErrorProps(errors, "amount")}
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
                        onClick={async () => {
                          if (
                            await confirmDialog({ title: "Delete this budget?" })
                          ) {
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
