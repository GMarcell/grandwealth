"use client"

import { useState, useMemo } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { savingsFormSchema } from "@/lib/validation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Landmark,
  TrendingUp,
  TrendingDown,
  Check,
  ChevronsUpDown,
  X,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { formatIDR, formatDate, cn } from "@/lib/utils"
import { FormError } from "@/components/ui/form-error"
import { toast } from "sonner"

interface BankSaving {
  id: string
  type: string
  accountName: string
  amount: number
  date: string
  notes: string | null
}

type SavingsFormData = z.infer<typeof savingsFormSchema>

const SAVING_TYPES = ["DEPOSIT", "WITHDRAWAL"] as const

const POPULAR_BANKS = [
  "BCA",
  "Mandiri",
  "BNI",
  "BRI",
  "BSI",
  "CIMB Niaga",
  "Danamon",
  "Permata",
  "OCBC NISP",
  "Maybank",
  "Panin",
  "UOB",
  "HSBC",
  "Jenius",
  "Bank Jago",
  "SeaBank",
  "Neo Commerce",
  "Bank Mega",
  "BTN",
  "BTPN",
]

export default function SavingsPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BankSaving | null>(null)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [comboboxQuery, setComboboxQuery] = useState("")

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<SavingsFormData>({
    resolver: zodResolver(savingsFormSchema),
    defaultValues: {
      type: "DEPOSIT",
      accountName: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  })

  const formAccountName = watch("accountName")

  const { data: savings, isLoading } = useQuery<BankSaving[]>({
    queryKey: ["savings"],
    queryFn: async () => {
      const res = await fetch("/api/savings");
      if (!res.ok) throw new Error("Failed to fetch savings");
      return res.json();
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || "Failed to add record")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Savings record added")
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add record"),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/savings/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || "Failed to update record")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Savings record updated")
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update record"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/savings/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete record")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Savings record deleted")
    },
    onError: () => toast.error("Failed to delete record"),
  })

  function resetForm() {
    setEditing(null)
    reset({
      type: "DEPOSIT",
      accountName: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    })
    setComboboxQuery("")
    setIsDialogOpen(false)
  }

  function openEdit(saving: BankSaving) {
    setEditing(saving)
    reset({
      type: saving.type as "DEPOSIT" | "WITHDRAWAL",
      accountName: saving.accountName,
      amount: saving.amount.toString(),
      date: new Date(saving.date).toISOString().split("T")[0],
      notes: saving.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  function onFormSubmit(data: SavingsFormData) {
    const payload = {
      type: data.type,
      accountName: data.accountName,
      amount: parseFloat(data.amount),
      date: new Date(data.date).toISOString(),
      notes: data.notes || undefined,
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const sorted = useMemo(() =>
    (savings ?? []).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    [savings]
  )

  const { totalDeposits, totalWithdrawals, netSavings, uniqueAccounts, accountSummaries } = useMemo(() => {
    let deposits = 0
    let withdrawals = 0
    const accounts = new Set<string>()
    const accountMap = new Map<string, { deposits: number; withdrawals: number }>()

    for (const s of savings ?? []) {
      accounts.add(s.accountName)
      if (!accountMap.has(s.accountName)) {
        accountMap.set(s.accountName, { deposits: 0, withdrawals: 0 })
      }
      const acc = accountMap.get(s.accountName)!
      if (s.type === "DEPOSIT") {
        deposits += s.amount
        acc.deposits += s.amount
      } else {
        withdrawals += s.amount
        acc.withdrawals += s.amount
      }
    }

    return {
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      netSavings: deposits - withdrawals,
      uniqueAccounts: accounts.size,
      accountSummaries: Array.from(accountMap.entries()).map(([name, data]) => ({
        name,
        balance: data.deposits - data.withdrawals,
        ...data,
      })),
    }
  }, [savings])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank Savings</h1>
          <p className="text-sm text-muted-foreground">
            Track your savings accounts
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Record Savings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Savings Record" : "Record Savings Transaction"}
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
                      {SAVING_TYPES.map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={field.value === t ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange(t)}
                          className="flex-1"
                        >
                          {t === "DEPOSIT" ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          {t === "DEPOSIT" ? "Deposit" : "Withdraw"}
                        </Button>
                      ))}
                    </div>                    )}
                />
                <FormError errors={errors} name="type" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Controller
                  name="accountName"
                  control={control}
                  render={({ field }) => (
                    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="accountName"
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            {field.value || "Select or type bank name..."}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            {field.value && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  field.onChange("")
                                  setComboboxQuery("")
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation()
                                    field.onChange("")
                                    setComboboxQuery("")
                                  }
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </span>
                            )}
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search bank name..."
                            value={comboboxQuery}
                            onValueChange={setComboboxQuery}
                          />
                          <CommandList>
                            <CommandEmpty>
                              <span className="py-6 text-center text-sm block">
                                {comboboxQuery
                                  ? `No bank named "${comboboxQuery}"`
                                  : "Type a bank name..."}
                              </span>
                            </CommandEmpty>
                            <CommandGroup heading="Popular Banks">
                              {POPULAR_BANKS.filter(
                                (b) =>
                                  !comboboxQuery ||
                                  b.toLowerCase().includes(comboboxQuery.toLowerCase())
                              ).map((bank) => (
                                <CommandItem
                                  key={bank}
                                  value={bank}
                                  onSelect={() => {
                                    field.onChange(bank)
                                    setComboboxOpen(false)
                                    setComboboxQuery("")
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === bank
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {bank}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            {comboboxQuery &&
                              !POPULAR_BANKS.some(
                                (b) =>
                                  b.toLowerCase() === comboboxQuery.toLowerCase()
                              ) && (
                                <CommandGroup heading="Custom">
                                  <CommandItem
                                    value={comboboxQuery}
                                    onSelect={() => {
                                      field.onChange(comboboxQuery)
                                      setComboboxOpen(false)
                                      setComboboxQuery("")
                                    }}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Use &ldquo;{comboboxQuery}&rdquo;
                                  </CommandItem>
                                </CommandGroup>
                              )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                />
                <FormError errors={errors} name="accountName" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (Rp)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  placeholder="1000000"
                  {...register("amount", { required: true })}
                />
                <FormError errors={errors} name="amount" />
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

              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notes <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="notes"
                  placeholder="e.g., Monthly salary deposit"
                  {...register("notes")}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                {editing ? "Update" : "Add"} Record
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Accounts</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueAccounts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatIDR(totalDeposits)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatIDR(totalWithdrawals)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
            <Landmark className={`h-4 w-4 ${netSavings >= 0 ? "text-emerald-500" : "text-red-500"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netSavings >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {formatIDR(netSavings)}
            </div>
            <Badge variant={netSavings >= 0 ? "profit" : "loss"} className="mt-1">
              {netSavings >= 0 ? "Positive" : "Negative"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Account Summaries */}
      {accountSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accountSummaries.map((acc) => (
                <div
                  key={acc.name}
                  className="flex items-center justify-between rounded-lg border p-3 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{acc.name}</p>
                      <p className="text-xs text-muted-foreground truncate sm:text-clip">
                        Deposits: {formatIDR(acc.deposits)}
                        {acc.withdrawals > 0 && ` · Withdrawn: ${formatIDR(acc.withdrawals)}`}
                      </p>
                    </div>
                  </div>
                  <div className={`text-xs sm:text-sm font-semibold shrink-0 ${acc.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatIDR(acc.balance)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Savings Records */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : sorted.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No savings records yet. Start tracking your savings!
              </p>
            </div>
          ) : (
            sorted.map((s) => (
              <div
                key={s.id}
                className="flex items-start sm:items-center justify-between rounded-lg border p-3 sm:p-4 hover:bg-muted/50 transition-colors group gap-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full ${
                    s.type === "DEPOSIT"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}>
                    {s.type === "DEPOSIT" ? (
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {s.type === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                      </p>
                      <Badge variant="secondary" className="text-[10px] leading-none shrink-0">
                        {s.accountName}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {formatDate(s.date)}
                      {s.notes && ` • ${s.notes}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right shrink-0">
                    <p className={`text-xs sm:text-sm font-semibold ${
                      s.type === "DEPOSIT"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {s.type === "DEPOSIT" ? "+" : "-"}{formatIDR(s.amount)}
                    </p>
                  </div>
                  <div className="flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)} className="min-w-9 min-h-9">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Delete this savings record?")) {
                          deleteMutation.mutate(s.id)
                        }
                      }}
                      className="min-w-9 min-h-9"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
