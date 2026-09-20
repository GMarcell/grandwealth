"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  HandCoins,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { UpcomingDividends, type ProjectedDividend } from "@/components/stocks/upcoming-dividends"
import { toast } from "sonner"

interface Dividend {
  id: string
  stockId: string
  symbol: string
  stockName: string
  amount: number
  date: string
  notes: string | null
}

interface StockOption {
  id: string
  symbol: string
  name: string
}

export function DividendsPanel() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<Dividend | null>(null)
  const [form, setForm] = useState({
    stockId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  })
  const [submitError, setSubmitError] = useState("")

  const { data, isLoading } = useQuery<{ data: Dividend[]; totalAmount: number }>({
    queryKey: ["dividends"],
    queryFn: async () => {
      const res = await fetch("/api/dividends")
      if (!res.ok) throw new Error("Failed to fetch dividends")
      return res.json()
    },
  })

  const { data: stocksData } = useQuery<{ data: StockOption[] }>({
    queryKey: ["all-stocks"],
    queryFn: async () => {
      const res = await fetch("/api/stocks?page=1&pageSize=200")
      if (!res.ok) throw new Error("Failed to fetch stocks")
      return res.json()
    },
  })

  const dividends = data?.data ?? []
  const totalAmount = data?.totalAmount ?? 0
  const stocks = stocksData?.data ?? []

  function resetForm() {
    setEditing(null)
    setForm({
      stockId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    })
    setSubmitError("")
    setIsOpen(false)
  }

  /**
   * Open the record dialog prefilled from a projected dividend, so the user
   * confirms the amount before it becomes an actual record.
   */
  function recordProjected(p: ProjectedDividend) {
    setEditing(null)
    const cadence =
      p.frequency !== "UNKNOWN" && p.frequency !== "IRREGULAR"
        ? ` (${p.frequency.toLowerCase()})`
        : ""
    setForm({
      stockId: p.stockId,
      amount: p.estimatedNextPayout != null ? String(p.estimatedNextPayout) : "",
      date: new Date().toISOString().split("T")[0],
      notes: `Estimated dividend${cadence}`,
    })
    setSubmitError("")
    setIsOpen(true)
  }

  function openEdit(d: Dividend) {
    setEditing(d)
    setForm({
      stockId: d.stockId,
      amount: d.amount.toString(),
      date: new Date(d.date).toISOString().split("T")[0],
      notes: d.notes ?? "",
    })
    setIsOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(form.amount)
      if (isNaN(amount) || amount <= 0) throw new Error("Enter a positive dividend amount")
      if (!form.stockId) throw new Error("Select a stock")
      const payload = {
        stockId: form.stockId,
        amount,
        date: new Date(form.date).toISOString(),
        notes: form.notes || undefined,
      }
      const res = await fetch(
        editing ? `/api/dividends/${editing.id}` : "/api/dividends",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const json = await res.json().catch(() => ({ error: "Failed to save dividend" }))
      if (!res.ok) throw new Error(json.error || "Failed to save dividend")
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dividends"] })
      toast.success(editing ? "Dividend updated" : "Dividend recorded")
      resetForm()
    },
    onError: (err) => setSubmitError(err instanceof Error ? err.message : "Failed to save dividend"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/dividends/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete dividend")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dividends"] })
      toast.success("Dividend deleted")
    },
    onError: () => toast.error("Failed to delete dividend"),
  })

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-emerald-500" />
              Dividend Income
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {dividends.length > 0
                ? `${dividends.length} record${dividends.length === 1 ? "" : "s"} · ${formatIDR(totalAmount)} total`
                : "Record dividend payouts from your holdings"}
            </p>
          </div>
          <Dialog open={isOpen} onOpenChange={(o) => !o && resetForm()}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={resetForm} disabled={stocks.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Add Dividend
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Dividend" : "Record Dividend"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setSubmitError("")
                  saveMutation.mutate()
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="divStock">Stock</Label>
                  <Select
                    value={form.stockId}
                    onValueChange={(v) => setForm((f) => ({ ...f, stockId: v }))}
                  >
                    <SelectTrigger id="divStock" className="w-full">
                      <SelectValue placeholder="Select a stock" />
                    </SelectTrigger>
                    <SelectContent>
                      {stocks.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.symbol} — {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="divAmount">Amount (Rp)</Label>
                    <Input
                      id="divAmount"
                      type="number"
                      min="1"
                      placeholder="250000"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="divDate">Pay date</Label>
                    <Input
                      id="divDate"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="divNotes">
                    Notes <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="divNotes"
                    placeholder="e.g., Interim dividend 2026"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                {submitError && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {submitError}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {editing ? "Save Changes" : "Record Dividend"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <UpcomingDividends onRecord={recordProjected} />

          <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recorded payouts
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : dividends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No dividends recorded yet.
              {stocks.length === 0 && " Add stocks first to record dividend payouts."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {dividends.slice(0, 8).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <HandCoins className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {d.symbol}
                        {d.notes && <span className="text-muted-foreground font-normal"> · {d.notes}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mr-1">
                      +{formatIDR(d.amount)}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(d)} className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" aria-label="Edit dividend">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm("Delete this dividend record?")) deleteMutation.mutate(d.id)
                      }}
                      className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                      aria-label="Delete dividend"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
