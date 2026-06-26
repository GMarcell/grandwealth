"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit2,
  Loader2,
  Search,
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
import { formatIDR, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface Stock {
  id: string
  symbol: string
  name: string
  quantity: number
  buyPrice: number
  currentPrice: number | null
  date: string
  notes: string | null
}

export default function StocksPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Stock | null>(null)
  const [formSymbol, setFormSymbol] = useState("")
  const [formName, setFormName] = useState("")
  const [formQuantity, setFormQuantity] = useState("")
  const [formBuyPrice, setFormBuyPrice] = useState("")
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0])
  const [formNotes, setFormNotes] = useState("")

  const { data: stocks, isLoading } = useQuery<Stock[]>({
    queryKey: ["stocks"],
    queryFn: () => fetch("/api/stocks").then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Stock added")
      resetForm()
    },
    onError: () => toast.error("Failed to add stock"),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`/api/stocks/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Stock updated")
      resetForm()
    },
    onError: () => toast.error("Failed to update stock"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/stocks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Stock deleted")
    },
    onError: () => toast.error("Failed to delete stock"),
  })

  function resetForm() {
    setEditing(null)
    setFormSymbol("")
    setFormName("")
    setFormQuantity("")
    setFormBuyPrice("")
    setFormDate(new Date().toISOString().split("T")[0])
    setFormNotes("")
    setIsDialogOpen(false)
  }

  function openEdit(stock: Stock) {
    setEditing(stock)
    setFormSymbol(stock.symbol)
    setFormName(stock.name)
    setFormQuantity(stock.quantity.toString())
    setFormBuyPrice(stock.buyPrice.toString())
    setFormDate(new Date(stock.date).toISOString().split("T")[0])
    setFormNotes(stock.notes ?? "")
    setIsDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      symbol: formSymbol.toUpperCase(),
      name: formName,
      quantity: parseInt(formQuantity),
      buyPrice: parseFloat(formBuyPrice),
      date: new Date(formDate).toISOString(),
      notes: formNotes || null,
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const filtered = (stocks ?? []).filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q)
    )
  })

  // Calculate totals
  const totalInvested = (stocks ?? []).reduce(
    (sum, s) => sum + s.quantity * s.buyPrice,
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stocks</h1>
          <p className="text-sm text-muted-foreground">
            Track your stock portfolio
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Add Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Stock" : "Add Stock"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="e.g., BBCA"
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="100"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Bank Central Asia Tbk."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyPrice">Buy Price (Rp)</Label>
                <Input
                  id="buyPrice"
                  type="number"
                  min="0"
                  step="25"
                  placeholder="10250"
                  value={formBuyPrice}
                  onChange={(e) => setFormBuyPrice(e.target.value)}
                  required
                />
              </div>

              {formQuantity && formBuyPrice && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <span className="text-muted-foreground">Total Investment: </span>
                  <span className="font-semibold">
                    {formatIDR(parseInt(formQuantity || "0") * parseFloat(formBuyPrice || "0"))}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="date">Purchase Date</Label>
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
                  placeholder="Any notes about this purchase"
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
                {editing ? "Update" : "Add"} Stock
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Stocks</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stocks?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Different companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stocks ?? []).reduce((sum, s) => sum + s.quantity, 0).toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(totalInvested)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by symbol or name..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Stocks List */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {search
                  ? "No stocks match your search."
                  : "No stocks yet. Add your first stock!"}
              </p>
            </div>
          ) : (
            filtered.map((s) => {
              const totalCost = s.quantity * s.buyPrice
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{s.symbol}</p>
                        <Badge variant="secondary" className="text-xs">
                          {s.quantity} shares
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.name} &bull; Bought {formatDate(s.date)}
                        {s.notes && ` • ${s.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatIDR(totalCost)}</p>
                      <p className="text-xs text-muted-foreground">
                        @ {formatIDR(s.buyPrice)}/share
                      </p>
                    </div>
                    <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Delete ${s.symbol} from portfolio?`)) {
                            deleteMutation.mutate(s.id)
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
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
