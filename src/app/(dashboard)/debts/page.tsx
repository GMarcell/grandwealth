"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { loanFormSchema } from "@/lib/validation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CreditCard,
  HandCoins,
  Percent,
  CalendarDays,
  TrendingDown,
  Wallet,
  CheckCircle2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FormError } from "@/components/ui/form-error"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatIDR, formatCompactIDR, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface Loan {
  id: string
  name: string
  principal: number
  remainingBalance: number
  interestRate: number | null
  monthlyPayment: number | null
  startDate: string
  notes: string | null
  createdAt: string
}

type LoanFormData = z.infer<typeof loanFormSchema>

export default function DebtsPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Loan | null>(null)
  const [paying, setPaying] = useState<Loan | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")

  const {
    register,
    handleSubmit: formSubmit,
    reset,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      name: "",
      principal: "",
      remainingBalance: "",
      interestRate: "",
      monthlyPayment: "",
      startDate: new Date().toISOString().split("T")[0],
      notes: "",
    },
  })

  const { data: loans, isLoading } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await fetch("/api/loans")
      if (!res.ok) throw new Error("Failed to fetch loans")
      return res.json()
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(id ? `/api/loans/${id}` : "/api/loans", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save loan" }))
        throw new Error(err.error || "Failed to save loan")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["net-worth"] })
      toast.success(editing ? "Loan updated" : "Loan added")
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save loan"),
  })

  const payMutation = useMutation({
    mutationFn: async ({ id, remainingBalance }: { id: string; remainingBalance: number }) => {
      const res = await fetch(`/api/loans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remainingBalance }),
      })
      if (!res.ok) throw new Error("Failed to record payment")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["net-worth"] })
      toast.success("Payment recorded")
      setPaying(null)
      setPaymentAmount("")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to record payment"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/loans/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete loan")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["net-worth"] })
      toast.success("Loan removed")
    },
    onError: () => toast.error("Failed to delete loan"),
  })

  function resetForm() {
    setEditing(null)
    reset({
      name: "",
      principal: "",
      remainingBalance: "",
      interestRate: "",
      monthlyPayment: "",
      startDate: new Date().toISOString().split("T")[0],
      notes: "",
    })
    setIsDialogOpen(false)
  }

  function openEdit(loan: Loan) {
    setEditing(loan)
    reset({
      name: loan.name,
      principal: loan.principal.toString(),
      remainingBalance: loan.remainingBalance.toString(),
      interestRate: loan.interestRate != null ? loan.interestRate.toString() : "",
      monthlyPayment: loan.monthlyPayment != null ? loan.monthlyPayment.toString() : "",
      startDate: new Date(loan.startDate).toISOString().split("T")[0],
      notes: loan.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  function onFormSubmit(data: LoanFormData) {
    const payload = {
      name: data.name,
      principal: parseFloat(data.principal),
      remainingBalance: data.remainingBalance ? parseFloat(data.remainingBalance) : parseFloat(data.principal),
      interestRate: data.interestRate ? parseFloat(data.interestRate) : null,
      monthlyPayment: data.monthlyPayment ? parseFloat(data.monthlyPayment) : null,
      startDate: new Date(data.startDate).toISOString(),
      notes: data.notes || null,
    }
    if (editing) {
      saveMutation.mutate({ id: editing.id, ...payload })
    } else {
      saveMutation.mutate(payload)
    }
  }

  const totalDebt = (loans ?? []).reduce((s, l) => s + l.remainingBalance, 0)
  const totalPrincipal = (loans ?? []).reduce((s, l) => s + l.principal, 0)
  const totalPaid = Math.max(0, totalPrincipal - totalDebt)
  const monthlyObligation = (loans ?? []).reduce((s, l) => s + (l.monthlyPayment ?? 0), 0)
  const clearedCount = (loans ?? []).filter((l) => l.remainingBalance <= 0).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debts &amp; Loans</h1>
          <p className="text-sm text-muted-foreground">
            Track liabilities so your net wealth is always accurate
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Add Loan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Loan" : "Add Loan / Debt"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={formSubmit(onFormSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Loan Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., KPR House, Car loan, KTA"
                  {...register("name", { required: true })}
                />
                <FormError errors={errors} name="name" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="principal">Principal (Rp)</Label>
                  <Input
                    id="principal"
                    type="number"
                    min="1"
                    placeholder="250000000"
                    {...register("principal", { required: true })}
                  />
                  <FormError errors={errors} name="principal" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remainingBalance">Remaining balance (Rp)</Label>
                  <Input
                    id="remainingBalance"
                    type="number"
                    min="0"
                    placeholder="150000000"
                    {...register("remainingBalance", { required: true })}
                  />
                  <FormError errors={errors} name="remainingBalance" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="interestRate">
                    Interest rate % <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="interestRate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="7.5"
                    {...register("interestRate")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyPayment">
                    Monthly payment (Rp) <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="monthlyPayment"
                    type="number"
                    min="0"
                    placeholder="2500000"
                    {...register("monthlyPayment")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register("startDate", { required: true })}
                />
                <FormError errors={errors} name="startDate" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notes <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="notes"
                  placeholder="e.g., 20-year mortgage, 6.5% fixed"
                  {...register("notes")}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editing ? "Save Changes" : "Add Loan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <CreditCard className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCompactIDR(totalDebt)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {loans?.length ?? 0} {loans?.length === 1 ? "loan" : "loans"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Principal</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompactIDR(totalPrincipal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCompactIDR(totalPaid)} paid off
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Obligation</CardTitle>
            <HandCoins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompactIDR(monthlyObligation)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyObligation > 0 ? "Total monthly payments" : "No payment recorded"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cleared</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clearedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {clearedCount > 0 ? "Fully paid off 🎉" : "None yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loan cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (loans ?? []).length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
              <CreditCard className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-medium mb-1">No loans tracked</p>
            <p className="text-xs text-muted-foreground mb-4">
              Add your mortgage, vehicle loans, or other debts to see your true net wealth.
            </p>
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add your first loan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(loans ?? []).map((loan) => {
            const paid = Math.max(0, loan.principal - loan.remainingBalance)
            const percent = loan.principal > 0
              ? Math.min(100, (paid / loan.principal) * 100)
              : 0
            const cleared = loan.remainingBalance <= 0

            return (
              <Card key={loan.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          {loan.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(loan.startDate)}
                          </span>
                          {loan.interestRate != null && (
                            <span className="flex items-center gap-1">
                              <Percent className="h-3 w-3" />
                              {loan.interestRate}%
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {cleared && (
                      <Badge variant="profit" className="text-[10px] shrink-0">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                        Cleared
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xl font-bold leading-none text-red-600 dark:text-red-400">
                        {formatCompactIDR(loan.remainingBalance)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        remaining of {formatIDR(loan.principal)} principal
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {percent.toFixed(0)}%
                      </span>
                      <p className="text-[10px] text-muted-foreground">paid off</p>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {loan.monthlyPayment != null && loan.monthlyPayment > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <TrendingDown className="h-3 w-3 inline mr-1" />
                      {formatIDR(loan.monthlyPayment)}/month
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1"
                      variant={cleared ? "outline" : "default"}
                      disabled={cleared}
                      onClick={() => {
                        setPaying(loan)
                        setPaymentAmount(loan.monthlyPayment?.toString() ?? "")
                      }}
                    >
                      <HandCoins className="h-4 w-4 mr-1" />
                      Record Payment
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(loan)}
                      aria-label="Edit loan"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm(`Delete the "${loan.name}" loan?`)) {
                          deleteMutation.mutate(loan.id)
                        }
                      }}
                      aria-label="Delete loan"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Record payment dialog */}
      <Dialog open={paying != null} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment for &ldquo;{paying?.name}&rdquo;</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const amount = parseFloat(paymentAmount)
              if (isNaN(amount) || amount <= 0) {
                toast.error("Enter a positive payment amount")
                return
              }
              const nextBalance = Math.max(0, (paying?.remainingBalance ?? 0) - amount)
              payMutation.mutate({ id: paying!.id, remainingBalance: nextBalance })
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Remaining balance</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {formatIDR(paying?.remainingBalance ?? 0)}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Payment amount (Rp)</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="1"
                max={paying?.remainingBalance}
                placeholder="2500000"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentAmount((paying?.remainingBalance ?? 0).toString())}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Pay in full
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={payMutation.isPending}
              >
                {payMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
