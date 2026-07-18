"use client"

import { useState, useMemo } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { goldFormSchema } from "@/lib/validation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  CircleDollarSign,
  Trash2,
  Edit2,
  Loader2,
  RefreshCw,
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
import { formatIDR, formatDate, type PaginatedResponse } from "@/lib/utils"
import { FormError } from "@/components/ui/form-error"
import { toast } from "sonner"

interface GoldDeposit {
  id: string
  type: string
  weightGram: number
  pricePerGram: number
  totalAmount: number
  date: string
  notes: string | null
}

type GoldFormData = z.infer<typeof goldFormSchema>

const GOLD_TYPES = ["BUY", "SELL"] as const

export default function GoldPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GoldDeposit | null>(null)

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<GoldFormData>({
    resolver: zodResolver(goldFormSchema),
    defaultValues: {
      type: "BUY",
      weight: "",
      price: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  })

  const formType = watch("type")
  const formWeight = watch("weight")
  const formPrice = watch("price")

  const { data: depositsData, isLoading } = useQuery({
    queryKey: ["gold", page],
    queryFn: async () => {
      const res = await fetch(`/api/gold?page=${page}&pageSize=25`);
      if (!res.ok) throw new Error("Failed to fetch gold deposits");
      const json: PaginatedResponse<GoldDeposit> = await res.json();
      return json;
    },
  })

  const deposits = depositsData?.data ?? []
  const pagination = depositsData?.pagination

  const { data: livePrice, isLoading: priceLoading } = useQuery<{
    pricePerGramIdr: number
    pricePerOunceIdr: number
    pricePerOunceUsd: number
    usdIdrRate: number
    updatedAt: string
  }>({
    queryKey: ["gold-price"],
    queryFn: async () => {
      const res = await fetch("/api/gold/price")
      if (!res.ok) throw new Error("Failed to fetch gold price")
      return res.json()
    },
    refetchInterval: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add gold record" }))
        throw new Error(err.error || "Failed to add gold record")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Gold record added")
      resetForm()
    },
    onError: (err) => toast.error(err.message || "Failed to add gold record"),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/gold/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update gold record" }))
        throw new Error(err.error || "Failed to update gold record")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Gold record updated")
      resetForm()
    },
    onError: (err) => toast.error(err.message || "Failed to update gold record"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/gold/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete gold record" }))
        throw new Error(err.error || "Failed to delete gold record")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Gold record deleted")
    },
    onError: (err) => toast.error(err.message || "Failed to delete gold record"),
  })

  function resetForm() {
    setEditing(null)
    reset({
      type: "BUY",
      weight: "",
      price: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    })
    setIsDialogOpen(false)
  }

  function openEdit(deposit: GoldDeposit) {
    setEditing(deposit)
    reset({
      type: deposit.type as "BUY" | "SELL",
      weight: deposit.weightGram.toString(),
      price: deposit.pricePerGram.toString(),
      date: new Date(deposit.date).toISOString().split("T")[0],
      notes: deposit.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  function onFormSubmit(data: GoldFormData) {
    const weight = parseFloat(data.weight)
    const price = parseFloat(data.price)
    const payload = {
      type: data.type,
      weightGram: weight,
      pricePerGram: price,
      totalAmount: weight * price,
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
    deposits.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    [deposits]
  )

  const { totalGoldWeight, totalGoldInvested } = useMemo(() => {
    let weight = 0
    let invested = 0
    for (const d of deposits) {
      if (d.type === "BUY") {
        weight += d.weightGram
        invested += d.totalAmount
      } else {
        weight -= d.weightGram
      }
    }
    return { totalGoldWeight: weight, totalGoldInvested: invested }
  }, [deposits])

  const currentValue = useMemo(() => {
    if (!livePrice) return null
    return totalGoldWeight * livePrice.pricePerGramIdr
  }, [totalGoldWeight, livePrice])

  const unrealizedPnl = useMemo(() => {
    if (currentValue == null) return null
    return currentValue - totalGoldInvested
  }, [currentValue, totalGoldInvested])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gold Deposits</h1>
          <p className="text-sm text-muted-foreground">
            Track your gold investments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => {
              setEditing(null)
              reset({
                type: "BUY",
                weight: "",
                price: livePrice ? livePrice.pricePerGramIdr.toString() : "",
                date: new Date().toISOString().split("T")[0],
                notes: "",
              })
            }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Record Gold
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Gold Record" : "Record Gold Transaction"}
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
                      {GOLD_TYPES.map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={field.value === t ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange(t)}
                          className="flex-1"
                        >
                          {t === "BUY" ? "Buy" : "Sell"}
                        </Button>
                      ))}
                    </div>                    )}
                />
                <FormError errors={errors} name="type" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (grams)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  placeholder="10.00"
                  {...register("weight", { required: true })}
                />
                <FormError errors={errors} name="weight" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price per Gram (Rp)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  placeholder="1000000"
                  {...register("price", { required: true })}
                />
                <FormError errors={errors} name="price" />
              </div>

              {formWeight && formPrice && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold">
                    {formatIDR(parseFloat(formWeight) * parseFloat(formPrice))}
                  </span>
                </div>
              )}

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
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g., Antam 10g"
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
                {editing ? "Update" : "Add"} Gold Record
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Gold</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalGoldWeight.toFixed(2)}g
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatIDR(totalGoldInvested)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Live Market Price</CardTitle>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["gold-price"] })}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${priceLoading ? "animate-spin" : ""}`} />
            </button>
          </CardHeader>
          <CardContent>
            {livePrice ? (
              <>
                <div className="text-2xl font-bold">{formatIDR(livePrice.pricePerGramIdr)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatIDR(livePrice.pricePerOunceIdr ?? 0)}/oz
                </p>
              </>
            ) : (
              <Skeleton className="h-8 w-32" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Price/Gram</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalGoldWeight > 0 ? formatIDR(totalGoldInvested / totalGoldWeight) : formatIDR(0)}
            </div>
          </CardContent>
        </Card>
        {currentValue != null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Current Value</CardTitle>
              <CircleDollarSign className={`h-4 w-4 ${unrealizedPnl != null && unrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(currentValue)}</div>
              {unrealizedPnl != null && (
                <p className={`text-xs mt-1 ${unrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {unrealizedPnl >= 0 ? "+" : ""}{formatIDR(unrealizedPnl)} (
                  {totalGoldInvested > 0
                    ? ((unrealizedPnl / totalGoldInvested) * 100).toFixed(1)
                    : "0.0"}
                  %)
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gold Records */}
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
                No gold records yet. Start tracking your gold!
              </p>
            </div>
          ) : (
            sorted.map((d) => (
              <div
                key={d.id}
                className="flex items-start sm:items-center justify-between rounded-lg border p-3 sm:p-4 hover:bg-muted/50 transition-colors group gap-2"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full ${
                    d.type === "BUY"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}>
                    <CircleDollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {d.type === "BUY" ? "Bought" : "Sold"} {d.weightGram.toFixed(2)}g
                      </p>
                      <Badge variant={d.type === "BUY" ? "profit" : "loss"} className="text-[10px] leading-none shrink-0">
                        {d.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      @ {formatIDR(d.pricePerGram)}/g &bull; {formatDate(d.date)}
                      {d.notes && ` • ${d.notes}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-semibold">{formatIDR(d.totalAmount)}</p>
                  </div>
                  <div className="flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)} className="min-w-9 min-h-9">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Delete this gold record?")) {
                          deleteMutation.mutate(d.id)
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
