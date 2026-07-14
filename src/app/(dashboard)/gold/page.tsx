"use client"

import { useState, useMemo } from "react"
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
import { formatIDR, formatDate } from "@/lib/utils"
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

const GOLD_TYPES = ["BUY", "SELL"] as const

export default function GoldPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GoldDeposit | null>(null)
  const [formType, setFormType] = useState("BUY")
  const [formWeight, setFormWeight] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0])
  const [formNotes, setFormNotes] = useState("")

  const { data: deposits, isLoading } = useQuery<GoldDeposit[]>({
    queryKey: ["gold"],
    queryFn: async () => {
      const res = await fetch("/api/gold");
      if (!res.ok) throw new Error("Failed to fetch gold deposits");
      return res.json();
    },
  })

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
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Gold record added")
      resetForm()
    },
    onError: () => toast.error("Failed to add gold record"),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`/api/gold/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Gold record updated")
      resetForm()
    },
    onError: () => toast.error("Failed to update gold record"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/gold/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gold"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Gold record deleted")
    },
    onError: () => toast.error("Failed to delete gold record"),
  })

  function resetForm() {
    setEditing(null)
    setFormType("BUY")
    setFormWeight("")
    setFormPrice("")
    setFormDate(new Date().toISOString().split("T")[0])
    setFormNotes("")
    setIsDialogOpen(false)
  }

  function openEdit(deposit: GoldDeposit) {
    setEditing(deposit)
    setFormType(deposit.type)
    setFormWeight(deposit.weightGram.toString())
    setFormPrice(deposit.pricePerGram.toString())
    setFormDate(new Date(deposit.date).toISOString().split("T")[0])
    setFormNotes(deposit.notes ?? "")
    setIsDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const weight = parseFloat(formWeight)
    const price = parseFloat(formPrice)
    const payload = {
      type: formType,
      weightGram: weight,
      pricePerGram: price,
      totalAmount: weight * price,
      date: new Date(formDate).toISOString(),
      notes: formNotes || null,
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const sorted = useMemo(() =>
    (deposits ?? []).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    [deposits]
  )

  // Calculate totals
  const { totalGoldWeight, totalGoldInvested } = useMemo(() => {
    let weight = 0
    let invested = 0
    for (const d of deposits ?? []) {
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
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  {GOLD_TYPES.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={formType === t ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormType(t)}
                      className="flex-1"
                    >
                      {t === "BUY" ? "Buy" : "Sell"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (grams)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="10.00"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price per Gram (Rp)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="1000000"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  required
                />
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
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g., Antam 10g"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
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
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    d.type === "BUY"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}>
                    <CircleDollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {d.type === "BUY" ? "Bought" : "Sold"} {d.weightGram.toFixed(2)}g
                      </p>
                      <Badge variant={d.type === "BUY" ? "profit" : "loss"}>
                        {d.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      @ {formatIDR(d.pricePerGram)}/g &bull; {formatDate(d.date)}
                      {d.notes && ` • ${d.notes}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatIDR(d.totalAmount)}</p>
                  </div>
                  <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)}>
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
