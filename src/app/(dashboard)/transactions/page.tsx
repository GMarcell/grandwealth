"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
import { formatIDR, formatDateTime } from "@/lib/utils"
import { getBudgetMonthKey, getBudgetMonthRange } from "@/lib/budget-months"
import { toast } from "sonner"

// Helper to check budget alert level
function getBudgetAlert(category: string, newAmount: number, budgets: any[], transactions: any[], startDay: number = 1): { level: "near" | "over" | null; message: string } {
  const monthKey = getBudgetMonthKey(new Date(), startDay)
  
  const budget = budgets?.find((b: any) => b.categoryName === category && b.month === monthKey)
  if (!budget) return { level: null, message: "" }

  // Calculate total spent for this category this budget month INCLUDING the new transaction
  const { start, end } = getBudgetMonthRange(monthKey, startDay)

  let totalSpent = newAmount // include the new transaction
  for (const tx of transactions ?? []) {
    if (tx.type !== "EXPENSE" || tx.category !== category) continue
    const txDate = new Date(tx.date)
    if (txDate >= start && txDate <= end) {
      totalSpent += tx.amount
    }
  }

  const percentUsed = (totalSpent / budget.amount) * 100
  const remaining = budget.amount - totalSpent

  if (percentUsed > 100) {
    return {
      level: "over",
      message: `${category.replace("_", " ")} budget exceeded! ${formatIDR(Math.abs(remaining))} over budget (${Math.round(percentUsed)}% used)`,
    }
  }
  if (percentUsed >= 80) {
    return {
      level: "near",
      message: `${category.replace("_", " ")} nearing budget limit: ${formatIDR(remaining)} remaining (${Math.round(percentUsed)}% used)`,
    }
  }

  return { level: null, message: "" }
}

const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const

const PREDEFINED_INCOME = [
  "SALARY", "FREELANCE", "BUSINESS", "INVESTMENT", "DIVIDEND",
  "INTEREST", "RENTAL", "GIFT", "REFUND", "OTHER_INCOME",
] as const

const PREDEFINED_EXPENSE = [
  "FOOD", "TRANSPORTATION", "HOUSING", "UTILITIES", "HEALTHCARE",
  "EDUCATION", "ENTERTAINMENT", "SHOPPING", "TRAVEL", "INSURANCE",
  "TAX", "SUBSCRIPTION", "OTHER_EXPENSE",
] as const

interface Transaction {
  id: string
  type: string
  category: string
  amount: number
  description: string
  date: string
}

function TransactionSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24 mt-1" />
        </div>
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export default function TransactionsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [formType, setFormType] = useState<string>("EXPENSE")
  const [formCategory, setFormCategory] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0])

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  })

  const { data: customCategories } = useQuery<Array<{ id: string; name: string; type: string; color: string }>>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  })

  const { data: budgets } = useQuery<any[]>({
    queryKey: ["budgets"],
    queryFn: async () => {
      const res = await fetch("/api/budgets");
      if (!res.ok) throw new Error("Failed to fetch budgets");
      return res.json();
    },
  })

  const { data: budgetSettings } = useQuery<{ budgetStartDay: number }>({
    queryKey: ["budget-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/budget-settings");
      if (!res.ok) throw new Error("Failed to fetch budget settings");
      return res.json();
    },
  })
  const startDay = budgetSettings?.budgetStartDay ?? 1

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      toast.success("Transaction added")
      
      // Check budget alert for expense transactions
      if (variables.type === "EXPENSE") {
        const alert = getBudgetAlert(variables.category, parseFloat(variables.amount.toString()), budgets ?? [], transactions ?? [], startDay)
        if (alert.level === "over") {
          toast.error(alert.message, { duration: 6000 })
        } else if (alert.level === "near") {
          toast.warning(alert.message, { duration: 5000 })
        }
      }
      
      resetForm()
    },
    onError: () => toast.error("Failed to add transaction"),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`/api/transactions/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      toast.success("Transaction updated")
      
      // Check budget alert for expense transactions
      if (variables.type === "EXPENSE") {
        // When editing, subtract the old amount from the total since it's still in cached data
        const oldAmount = editingTransaction?.amount ? parseFloat(editingTransaction.amount.toString()) : 0
        const netAdditional = parseFloat(variables.amount.toString()) - oldAmount
        const alert = getBudgetAlert(variables.category, netAdditional, budgets ?? [], transactions ?? [], startDay)
        if (alert.level === "over") {
          toast.error(alert.message, { duration: 6000 })
        } else if (alert.level === "near") {
          toast.warning(alert.message, { duration: 5000 })
        }
      }
      
      resetForm()
    },
    onError: () => toast.error("Failed to update transaction"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Transaction deleted")
    },
    onError: () => toast.error("Failed to delete transaction"),
  })

  function resetForm() {
    setEditingTransaction(null)
    setFormType("EXPENSE")
    setFormCategory("")
    setFormAmount("")
    setFormDescription("")
    setFormDate(new Date().toISOString().split("T")[0])
    setIsDialogOpen(false)
  }

  function openEdit(tx: Transaction) {
    setEditingTransaction(tx)
    setFormType(tx.type)
    setFormCategory(tx.category)
    setFormAmount(tx.amount.toString())
    setFormDescription(tx.description)
    setFormDate(new Date(tx.date).toISOString().split("T")[0])
    setIsDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      type: formType,
      category: formCategory,
      amount: parseFloat(formAmount),
      description: formDescription,
      date: new Date(formDate).toISOString(),
    }

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const filtered = useMemo(() =>
    (transactions ?? [])
      .filter((tx) => {
        if (typeFilter !== "ALL" && tx.type !== typeFilter) return false
        if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions, typeFilter, search]
  )

  const totalIncome = useMemo(() =>
    (transactions ?? [])
      .filter((tx) => tx.type === "INCOME")
      .reduce((sum, tx) => sum + tx.amount, 0),
    [transactions]
  )

  const totalExpenses = useMemo(() =>
    (transactions ?? [])
      .filter((tx) => tx.type === "EXPENSE")
      .reduce((sum, tx) => sum + tx.amount, 0),
    [transactions]
  )

  const categories = useMemo(() => {
    const userCats = (customCategories ?? [])
      .filter((c) => c.type === formType)
      .map((c) => c.name)
    const predefined = formType === "INCOME" ? PREDEFINED_INCOME : PREDEFINED_EXPENSE
    return [...predefined, ...userCats.filter((c) => !(predefined as readonly string[]).includes(c))]
  }, [customCategories, formType])

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
                const file = e.target.files?.[0]
                if (!file) return

                const formData = new FormData()
                formData.append("file", file)

                toast.loading("Importing transactions...")
                try {
                  const res = await fetch("/api/transactions/import", {
                    method: "POST",
                    body: formData,
                  })
                  const result = await res.json()
                  toast.dismiss()

                  if (!res.ok) {
                    toast.error(result.error || "Import failed")
                    if (result.importErrors?.length > 0) {
                      console.error("Import errors:", result.importErrors)
                    }
                  } else {
                    toast.success(result.message)
                    queryClient.invalidateQueries({ queryKey: ["transactions"] })
                    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
                  }
                } catch {
                  toast.dismiss()
                  toast.error("Failed to import CSV")
                }
                // Reset input
                e.target.value = ""
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
                const res = await fetch("/api/transactions/export")
                if (!res.ok) throw new Error("Export failed")
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`
                a.click()
                URL.revokeObjectURL(url)
                toast.success("Transactions exported")
              } catch {
                toast.error("Failed to export transactions")
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
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  {TRANSACTION_TYPES.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={formType === t ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setFormType(t); setFormCategory("") }}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory} required>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (Rp)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="100000"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="What was this for?"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
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
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
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
            <div className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {formatIDR(totalIncome - totalExpenses)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
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
      </div>

      {/* Transaction List */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <TransactionSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {search || typeFilter !== "ALL"
                  ? "No transactions match your filters."
                  : "No transactions yet. Add your first one!"}
              </p>
            </div>
          ) : (
            filtered.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors group"
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{tx.category.replace("_", " ")}</span>
                      <span>&bull;</span>
                      <span>{formatDateTime(tx.date)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-semibold ${
                    tx.type === "INCOME"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {tx.type === "INCOME" ? "+" : "-"}{formatIDR(tx.amount)}
                  </div>
                  <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(tx)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Delete this transaction?")) {
                          deleteMutation.mutate(tx.id)
                        }
                      }}
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
