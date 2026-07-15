"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { recurringFormSchema } from "@/lib/validation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Repeat,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
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
import { formatIDR, formatDate } from "@/lib/utils"
import { FormError } from "@/components/ui/form-error"
import { toast } from "sonner"

interface RecurringTransaction {
  id: string
  type: string
  category: string
  amount: number
  description: string
  frequency: string
  startDate: string
  endDate: string | null
  nextDate: string
  active: boolean
}

type RecurringFormData = z.infer<typeof recurringFormSchema>

const PREDEFINED_INCOME = [
  "SALARY", "FREELANCE", "BUSINESS", "INVESTMENT", "DIVIDEND",
  "INTEREST", "RENTAL", "GIFT", "REFUND", "OTHER_INCOME",
] as const

const PREDEFINED_EXPENSE = [
  "FOOD", "TRANSPORTATION", "HOUSING", "UTILITIES", "HEALTHCARE",
  "EDUCATION", "ENTERTAINMENT", "SHOPPING", "TRAVEL", "INSURANCE",
  "TAX", "SUBSCRIPTION", "OTHER_EXPENSE",
] as const

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
]

function frequencyLabel(freq: string): string {
  switch (freq) {
    case "WEEKLY": return "Weekly"
    case "MONTHLY": return "Monthly"
    case "YEARLY": return "Yearly"
    default: return freq
  }
}

function getNextOccurrenceText(nextDate: string): string {
  const next = new Date(nextDate)
  const now = new Date()
  const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "Overdue"
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays <= 7) return `In ${diffDays} days`
  if (diffDays <= 30) return `In ${Math.floor(diffDays / 7)} weeks`
  return formatDate(next)
}

export default function RecurringPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<RecurringFormData>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      type: "EXPENSE",
      category: "",
      amount: "",
      description: "",
      frequency: "MONTHLY",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      nextDate: new Date().toISOString().split("T")[0],
    },
  })

  const formType = watch("type")
  const formFrequency = watch("frequency")

  const { data: recurring, isLoading } = useQuery<RecurringTransaction[]>({
    queryKey: ["recurring-transactions"],
    queryFn: async () => {
      const res = await fetch("/api/recurring-transactions");
      if (!res.ok) throw new Error("Failed to fetch recurring transactions");
      return res.json();
    },
  })

  const { data: customCategories } = useQuery<Array<{ id: string; name: string; type: string }>>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/recurring-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create recurring transaction" }))
        throw new Error(err.error || "Failed to create recurring transaction")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] })
      toast.success("Recurring transaction created")
      resetForm()
    },
    onError: (err) => toast.error(err.message || "Failed to create recurring transaction"),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/recurring-transactions/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update recurring transaction" }))
        throw new Error(err.error || "Failed to update recurring transaction")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] })
      toast.success("Recurring transaction updated")
      resetForm()
    },
    onError: (err) => toast.error(err.message || "Failed to update recurring transaction"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-transactions/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete recurring transaction" }))
        throw new Error(err.error || "Failed to delete recurring transaction")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] })
      toast.success("Recurring transaction deleted")
    },
    onError: (err) => toast.error(err.message || "Failed to delete recurring transaction"),
  })

  const toggleMutation = useMutation({
    mutationFn: async (data: { id: string; active: boolean }) => {
      const res = await fetch(`/api/recurring-transactions/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: data.active }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to toggle recurring transaction" }))
        throw new Error(err.error || "Failed to toggle recurring transaction")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] })
    },
    onError: (err) => toast.error(err.message || "Failed to toggle recurring transaction"),
  })

  function resetForm() {
    setEditing(null)
    reset({
      type: "EXPENSE",
      category: "",
      amount: "",
      description: "",
      frequency: "MONTHLY",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      nextDate: new Date().toISOString().split("T")[0],
    })
    setIsDialogOpen(false)
  }

  function openEdit(item: RecurringTransaction) {
    setEditing(item)
    reset({
      type: item.type as "INCOME" | "EXPENSE",
      category: item.category,
      amount: item.amount.toString(),
      description: item.description,
      frequency: item.frequency as "WEEKLY" | "MONTHLY" | "YEARLY",
      startDate: new Date(item.startDate).toISOString().split("T")[0],
      endDate: item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "",
      nextDate: new Date(item.nextDate).toISOString().split("T")[0],
    })
    setIsDialogOpen(true)
  }

  function onFormSubmit(data: RecurringFormData) {
    const payload = {
      type: data.type,
      category: data.category,
      amount: parseFloat(data.amount),
      description: data.description,
      frequency: data.frequency,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      nextDate: new Date(data.nextDate).toISOString(),
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const userCats = (customCategories ?? [])
    .filter((c) => c.type === formType)
    .map((c) => c.name)
  const predefined = formType === "INCOME" ? PREDEFINED_INCOME : PREDEFINED_EXPENSE
  const categories = [...predefined, ...userCats.filter((c) => !(predefined as readonly string[]).includes(c))]

  // Sort: active first, then by nextDate
  const sorted = (recurring ?? []).sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime()
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Set up automatic transactions that repeat on a schedule
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Add Recurring
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Recurring Transaction" : "New Recurring Transaction"}
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
                      {["INCOME", "EXPENSE"].map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={field.value === t ? "default" : "outline"}
                          size="sm"
                          onClick={() => { field.onChange(t); }}
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
                    </div>                    )}
                />
                <FormError errors={errors} name="type" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat">Category</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} required>
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
                <FormError errors={errors} name="category" />
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
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  placeholder="e.g., Monthly salary"
                  {...register("description", { required: true })}
                />
                <FormError errors={errors} name="description" />
              </div>

              <div className="space-y-2">
                <Label>Frequency</Label>
                <Controller
                  name="frequency"
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-2">
                      {FREQUENCIES.map((f) => (
                        <Button
                          key={f.value}
                          type="button"
                          variant={field.value === f.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange(f.value)}
                          className="flex-1"
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          {f.label}
                        </Button>
                      ))}
                    </div>                    )}
                />
                <FormError errors={errors} name="frequency" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...register("startDate", { required: true })}
                  />
                  <FormError errors={errors} name="startDate" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextDate">Next Occurrence</Label>
                  <Input
                    id="nextDate"
                    type="date"
                    {...register("nextDate", { required: true })}
                  />
                  <FormError errors={errors} name="nextDate" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">
                  End Date <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register("endDate")}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no end date (repeats indefinitely)
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                {editing ? "Update" : "Create"} Recurring Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      {recurring && recurring.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
              <Repeat className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {recurring.filter((r) => r.active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatIDR(
                  recurring
                    .filter((r) => r.active && r.type === "INCOME")
                    .reduce((s, r) => s + r.amount, 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Monthly income recurring</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatIDR(
                  recurring
                    .filter((r) => r.active && r.type === "EXPENSE")
                    .reduce((s, r) => s + r.amount, 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Monthly expense recurring</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recurring Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Recurring Schedules
            {recurring && (
              <span className="text-sm font-normal text-muted-foreground">
                ({recurring.length} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          ) : sorted.length === 0 ? (
            <div className="text-center py-8">
              <Repeat className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                No recurring transactions yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Set up recurring income (salary, freelance) or expenses (rent, subscriptions) that happen on a schedule.
              </p>
            </div>
          ) : (
            sorted.map((r) => {
              const nextText = getNextOccurrenceText(r.nextDate)
              return (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 sm:p-4 transition-colors group ${
                    !r.active ? "opacity-50" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full ${
                        r.type === "INCOME"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}>
                        {r.type === "INCOME" ? (
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{r.description}</p>
                          <Badge variant="secondary" className="text-[10px] leading-none shrink-0">
                            {frequencyLabel(r.frequency)}
                          </Badge>
                          {!r.active && (
                            <Badge variant="secondary" className="text-[10px] leading-none shrink-0">
                              Paused
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate">{r.category.replace("_", " ")}</span>
                          <span className="hidden sm:inline shrink-0" aria-hidden="true">&bull;</span>
                          <span className={`truncate ${
                            nextText === "Overdue" ? "text-red-500 font-medium" : ""
                          }`}>
                            <Calendar className="h-3 w-3 inline mr-0.5 shrink-0" />
                            Next: {nextText}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${
                          r.type === "INCOME"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {r.type === "INCOME" ? "+" : "-"}{formatIDR(r.amount)}
                        </p>
                      </div>
                      <div className="flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleMutation.mutate({ id: r.id, active: !r.active })}
                          title={r.active ? "Pause" : "Resume"}
                          className="min-w-9 min-h-9"
                        >
                          {r.active ? (
                            <ToggleRight className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)} className="min-w-9 min-h-9">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (confirm(`Delete "${r.description}" recurring transaction?`)) {
                              deleteMutation.mutate(r.id)
                            }
                          }}
                          className="min-w-9 min-h-9"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
