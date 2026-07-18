"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { stockFormSchema } from "@/lib/validation"
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
import { formatIDR, formatDate, cn, type PaginatedResponse } from "@/lib/utils"
import { FormError } from "@/components/ui/form-error"
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

type StockFormData = z.infer<typeof stockFormSchema>

export default function StocksPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Stock | null>(null)

  // Stock search combobox state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; exchange: string }>>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockFormData>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      symbol: "",
      name: "",
      quantity: "",
      buyPrice: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  })

  const formQuantity = watch("quantity")
  const formBuyPrice = watch("buyPrice")

  // Debounced stock search via Yahoo Finance API
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results ?? [])
      }
    } catch {
      // Silently handle
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // Debounce effect
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => doSearch(searchQuery), 350)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, doSearch])

  // Reset search when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      setSearchQuery("")
      setSearchResults([])
      setSearchOpen(false)
    }
  }, [isDialogOpen])

  const { data: stocksData, isLoading } = useQuery({
    queryKey: ["stocks", page],
    queryFn: async () => {
      const res = await fetch(`/api/stocks?page=${page}&pageSize=25`);
      if (!res.ok) throw new Error("Failed to fetch stocks");
      const json: PaginatedResponse<Stock> = await res.json();
      return json;
    },
  })

  const stocks = stocksData?.data ?? []
  const pagination = stocksData?.pagination

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || "Failed to add stock")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Stock added")
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add stock"),
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/stocks/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error || "Failed to update stock")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Stock updated")
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update stock"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stocks/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete stock")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Stock deleted")
    },
    onError: () => toast.error("Failed to delete stock"),
  })

  const refreshPricesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stocks/update-prices", { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to refresh prices" }))
        throw new Error(err.error || "Failed to refresh prices")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      if (data?.warning) {
        toast.warning(data.warning, { duration: 8000 })
      } else {
        toast.success("Stock prices refreshed")
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to refresh prices"),
  })

  function resetForm() {
    setEditing(null)
    reset({
      symbol: "",
      name: "",
      quantity: "",
      buyPrice: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    })
    setSearchQuery("")
    setSearchResults([])
    setIsDialogOpen(false)
  }

  function openEdit(stock: Stock) {
    setEditing(stock)
    reset({
      symbol: stock.symbol,
      name: stock.name,
      quantity: stock.quantity.toString(),
      buyPrice: stock.buyPrice.toString(),
      date: new Date(stock.date).toISOString().split("T")[0],
      notes: stock.notes ?? "",
    })
    setIsDialogOpen(true)
  }

  function onFormSubmit(data: StockFormData) {
    const payload = {
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      quantity: parseInt(data.quantity),
      buyPrice: parseFloat(data.buyPrice),
      date: new Date(data.date).toISOString(),
      notes: data.notes || undefined,
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const filtered = useMemo(() =>
    stocks.filter((s) => {
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
  // 1 lot = 100 shares
  const SHARES_PER_LOT = 100

  const totalInvested = useMemo(() =>
    stocks.reduce(
      (sum, s) => sum + s.quantity * s.buyPrice,
      0
    ),
    [stocks]
  )

  const totalMarketValue = useMemo(() =>
    stocks.reduce(
      (sum, s) => sum + s.quantity * (s.currentPrice != null ? s.currentPrice * SHARES_PER_LOT : s.buyPrice),
      0
    ),
    [stocks]
  )

  const totalPnl = totalMarketValue - totalInvested
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  const stocksWithPrice = useMemo(() =>
    stocks.filter((s) => s.currentPrice != null).length,
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
              <form onSubmit={formSubmit(onFormSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Controller
                      name="symbol"
                      control={control}
                      render={({ field }) => (
                        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={searchOpen}
                              className={cn(
                                "w-full justify-between overflow-hidden",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <span className="truncate">
                                {field.value
                                  ? `${field.value}${watch("name") ? ` — ${watch("name")}` : ""}`
                                  : "Search stock symbol..."}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                {field.value && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      field.onChange("")
                                      setValue("name", "")
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.stopPropagation()
                                        field.onChange("")
                                        setValue("name", "")
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
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Type company name or symbol..."
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                              />
                              <CommandList>
                                {searchLoading ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                  </div>
                                ) : searchQuery.length < 2 ? (
                                  <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
                                ) : searchResults.length === 0 ? (
                                  <CommandEmpty>No stocks found for "{searchQuery}".</CommandEmpty>
                                ) : (
                                  <CommandGroup>
                                    {searchResults.map((stock) => (
                                      <CommandItem
                                        key={stock.symbol}
                                        value={stock.symbol}
                                        onSelect={() => {
                                          field.onChange(stock.symbol)
                                          setValue("name", stock.name)
                                          setSearchOpen(false)
                                          setSearchQuery("")
                                          setSearchResults([])
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === stock.symbol ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">{stock.symbol}</span>
                                            {stock.exchange && (
                                              <span className="text-[10px] uppercase text-muted-foreground">
                                                {stock.exchange}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                                            {stock.name}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity (lots)</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      placeholder="1"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      {...register("quantity", { required: true })}
                    />
                    <FormError errors={errors} name="quantity" />
                    <p className="text-[10px] text-muted-foreground">
                      1 lot = 100 shares
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Bank Central Asia Tbk."
                    {...register("name", { required: true })}
                  />
                  <FormError errors={errors} name="name" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buyPrice">Buy Price per Lot (Rp)</Label>
                  <Input
                    id="buyPrice"
                    type="number"
                    min="0"
                    placeholder="1025000"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    {...register("buyPrice", { required: true })}
                  />
                  <FormError errors={errors} name="buyPrice" />
                </div>

                {formQuantity && formBuyPrice && (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <span className="text-muted-foreground">Total Investment: </span>
                    <span className="font-semibold">
                      {formatIDR(parseInt(formQuantity || "0") * parseFloat(formBuyPrice || "0"))}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {parseInt(formQuantity || "0")} lot × {formatIDR(parseFloat(formBuyPrice || "0"))}/lot
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="date">Purchase Date</Label>
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
                    placeholder="Any notes about this purchase"
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
            <div className="text-2xl font-bold">{pagination?.total ?? stocks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Different companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Lots</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stocks.reduce((sum, s) => sum + s.quantity, 0).toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stocks.reduce((sum, s) => sum + s.quantity, 0) * 100} shares
            </p>
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
            ? `${stocksWithPrice}/${stocks.length} stocks have live prices`
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
              const shares = s.quantity * SHARES_PER_LOT
              const totalCost = s.quantity * s.buyPrice
              // currentPrice from Yahoo is per share, convert to per lot
              const currentPricePerLot = s.currentPrice != null ? s.currentPrice * SHARES_PER_LOT : null
              const marketValue = currentPricePerLot != null ? s.quantity * currentPricePerLot : null
              const pnl = marketValue != null ? marketValue - totalCost : null
              const pnlPercent = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null

              return (
                <div
                  key={s.id}
                  className="rounded-lg border p-3 sm:p-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold">{s.symbol}</p>
                          <Badge variant="secondary" className="text-[10px] leading-none shrink-0">
                            {s.quantity} {s.quantity === 1 ? "lot" : "lots"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {shares.toLocaleString("id-ID")} shares &bull; {s.name} &bull; {formatDate(s.date)}
                          {s.notes && ` • ${s.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <div className="text-right hidden sm:block">
                        {currentPricePerLot != null ? (
                          <>
                            <p className="text-sm font-medium">{formatIDR(s.currentPrice!)}</p>
                            <p className="text-xs text-muted-foreground">/share</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">—</p>
                            <p className="text-xs text-muted-foreground">No price</p>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        {pnl != null ? (
                          <>
                            <p className={`text-xs sm:text-sm font-semibold ${pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              {formatIDR(pnl)}
                            </p>
                            <p className={`text-[10px] sm:text-xs ${pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              {pnlPercent != null ? `${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%` : ""}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs sm:text-sm font-semibold">{formatIDR(totalCost)}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Cost</p>
                          </>
                        )}
                      </div>
                      <div className="flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)} className="min-w-9 min-h-9">
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
