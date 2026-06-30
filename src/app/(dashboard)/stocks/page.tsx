"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit2,
  Loader2,
  Search,
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
import { formatIDR, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface Stock {
  id: string
  symbol: string
  name: string
  quantity: number
  buyPrice: number
  currentPrice: number | null
  lastPriceUpdated: string | null
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
    queryFn: async () => {
      const res = await fetch("/api/stocks");
      if (!res.ok) throw new Error("Failed to fetch stocks");
      return res.json();
    },
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

  const refreshPricesMutation = useMutation({
    mutationFn: () =>
      fetch("/api/stocks/update-prices", { method: "POST" }),
    onSuccess: (res) => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["stocks"] })
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
        toast.success("Stock prices refreshed")
      } else {
        toast.error("Failed to refresh prices")
      }
    },
    onError: () => toast.error("Failed to refresh prices"),
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

  const filtered = useMemo(() =>
    (stocks ?? []).filter((s) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
      )
    }),
    [stocks, search]
  )

  // Calculate totals
  const totalInvested = useMemo(() =>
    (stocks ?? []).reduce(
      (sum, s) => sum + s.quantity * s.buyPrice,
      0
    ),
    [stocks]
  )

  const totalMarketValue = useMemo(() =>
    (stocks ?? []).reduce(
      (sum, s) => sum + s.quantity * (s.currentPrice ?? s.buyPrice),
      0
    ),
    [stocks]
  )

  const totalPnl = totalMarketValue - totalInvested
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  const stocksWithPrice = useMemo(() =>
    (stocks ?? []).filter((s) => s.currentPrice != null).length,
    [stocks]
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
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshPricesMutation.mutate()}
            disabled={refreshPricesMutation.isPending}
            className="flex-1 sm:flex-initial"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshPricesMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Prices
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => resetForm()} className="flex-1 sm:flex-initial">
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Market Value</CardTitle>
            <TrendingUp className={`h-4 w-4 ${totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(totalMarketValue)}</div>
            <p className={`text-xs mt-1 ${totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {totalPnl >= 0 ? "+" : ""}{formatIDR(totalPnl)} ({totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Refresh */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by symbol or name..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {stocksWithPrice > 0
            ? `${stocksWithPrice}/${stocks?.length ?? 0} stocks have live prices`
            : "Click \"Refresh Prices\" to get live data"}
        </p>
      </div>

      {/* Stocks List */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
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
              const hasPrice = s.currentPrice != null
              const marketValue = hasPrice ? s.quantity * s.currentPrice! : null
              const pnl = marketValue != null ? marketValue - totalCost : null
              const pnlPercent = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{s.symbol}</p>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {s.quantity} shares
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {s.name} &bull; Bought {formatDate(s.date)}
                        {s.notes && ` • ${s.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      {hasPrice ? (
                        <>
                          <p className="text-sm font-medium">{formatIDR(s.currentPrice!)}</p>
                          <p className="text-xs text-muted-foreground">Current</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">—</p>
                          <p className="text-xs text-muted-foreground">No price</p>
                        </>
                      )}
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-muted-foreground">{formatIDR(s.buyPrice)}</p>
                      <p className="text-xs text-muted-foreground">Buy price</p>
                    </div>
                    <div className="text-right">
                      {pnl != null ? (
                        <>
                          <p className={`text-sm font-semibold ${pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {formatIDR(pnl)}
                          </p>
                          <p className={`text-xs ${pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {pnlPercent != null ? `${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%` : ""}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold">{formatIDR(totalCost)}</p>
                          <p className="text-xs text-muted-foreground">Cost</p>
                        </>
                      )}
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
