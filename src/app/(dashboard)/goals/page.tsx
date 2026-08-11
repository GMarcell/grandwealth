"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { goalFormSchema } from "@/lib/validation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Target,
  CalendarDays,
  TrendingUp,
  Coins,
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

interface Goal {
  id: string
  name: string
  targetAmount: number
  savedAmount: number
  targetDate: string | null
  color: string
  createdAt: string
}

type GoalFormData = z.infer<typeof goalFormSchema>

const GOAL_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
]

export default function GoalsPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [contributing, setContributing] = useState<Goal | null>(null)
  const [contributeAmount, setContributeAmount] = useState("")

  const {
    register,
    handleSubmit: formSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: "",
      targetAmount: "",
      savedAmount: "",
      targetDate: "",
      color: GOAL_COLORS[0],
    },
  })

  const selectedColor = watch("color") || GOAL_COLORS[0]

  const { data: goals, isLoading } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const res = await fetch("/api/goals")
      if (!res.ok) throw new Error("Failed to fetch goals")
      return res.json()
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(id ? `/api/goals/${id}` : "/api/goals", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save goal" }))
        throw new Error(err.error || "Failed to save goal")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(editing ? "Goal updated" : "Goal created")
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save goal"),
  })

  const contributeMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await fetch(`/api/goals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) throw new Error("Failed to add to goal")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Contribution added")
      setContributing(null)
      setContributeAmount("")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add to goal"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/goals/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete goal")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Goal deleted")
    },
    onError: () => toast.error("Failed to delete goal"),
  })

  function resetForm() {
    setEditing(null)
    reset({
      name: "",
      targetAmount: "",
      savedAmount: "",
      targetDate: "",
      color: GOAL_COLORS[0],
    })
    setIsDialogOpen(false)
  }

  function openEdit(goal: Goal) {
    setEditing(goal)
    reset({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      savedAmount: goal.savedAmount.toString(),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split("T")[0] : "",
      color: goal.color || GOAL_COLORS[0],
    })
    setIsDialogOpen(true)
  }

  function onFormSubmit(data: GoalFormData) {
    const payload = {
      name: data.name,
      targetAmount: parseFloat(data.targetAmount),
      savedAmount: data.savedAmount ? parseFloat(data.savedAmount) : 0,
      targetDate: data.targetDate || null,
      color: data.color || GOAL_COLORS[0],
    }
    if (editing) {
      saveMutation.mutate({ id: editing.id, ...payload })
    } else {
      saveMutation.mutate(payload)
    }
  }

  const totalTarget = (goals ?? []).reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = (goals ?? []).reduce((s, g) => s + g.savedAmount, 0)
  const completedCount = (goals ?? []).filter((g) => g.savedAmount >= g.targetAmount).length
  const overallPercent = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Savings Goals</h1>
          <p className="text-sm text-muted-foreground">
            Set a target, track progress, and reach it one contribution at a time
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Goal" : "Create Savings Goal"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={formSubmit(onFormSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Emergency fund"
                  {...register("name", { required: true })}
                />
                <FormError errors={errors} name="name" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="targetAmount">Target (Rp)</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    min="1"
                    placeholder="10000000"
                    {...register("targetAmount", { required: true })}
                  />
                  <FormError errors={errors} name="targetAmount" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="savedAmount">
                    Already saved (Rp){" "}
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="savedAmount"
                    type="number"
                    min="0"
                    placeholder="0"
                    {...register("savedAmount")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetDate">
                  Target date <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="targetDate"
                  type="date"
                  {...register("targetDate")}
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setValue("color", c)}
                      className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                        selectedColor === c ? "ring-2 ring-offset-2 ring-foreground" : ""
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editing ? "Save Changes" : "Create Goal"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Targets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompactIDR(totalTarget)}</div>
            <p className="text-xs text-muted-foreground mt-1">{goals?.length ?? 0} goals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
            <Coins className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCompactIDR(totalSaved)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallPercent.toFixed(0)}% of overall target
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedCount > 0 ? "Goals reached — nice work! 🎉" : "Keep going!"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall progress */}
      {goals && goals.length > 0 && (
        <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall progress</span>
              <span className="font-medium">{overallPercent.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : (goals ?? []).length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-medium mb-1">No savings goals yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create a goal like an emergency fund, vacation, or down payment.
            </p>
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create your first goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(goals ?? []).map((goal) => {
            const percent = goal.targetAmount > 0
              ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100)
              : 0
            const completed = goal.savedAmount >= goal.targetAmount

            return (
              <Card key={goal.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                <div className="h-1.5 w-full" style={{ backgroundColor: goal.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${goal.color}1a`, color: goal.color }}
                      >
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          {goal.name}
                        </CardTitle>
                        {goal.targetDate && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(goal.targetDate)}
                          </p>
                        )}
                      </div>
                    </div>
                    {completed && (
                      <Badge variant="profit" className="text-[10px] shrink-0">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                        Done
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-xl font-bold leading-none">
                        {formatCompactIDR(goal.savedAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        of {formatIDR(goal.targetAmount)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: goal.color }}>
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ backgroundColor: goal.color, width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1"
                      variant={completed ? "outline" : "default"}
                      onClick={() => {
                        setContributing(goal)
                        setContributeAmount("")
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Contribute
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(goal)}
                      aria-label="Edit goal"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm(`Delete the "${goal.name}" goal?`)) {
                          deleteMutation.mutate(goal.id)
                        }
                      }}
                      aria-label="Delete goal"
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

      {/* Contribute dialog */}
      <Dialog open={contributing != null} onOpenChange={(o) => !o && setContributing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add to &ldquo;{contributing?.name}&rdquo;
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const amount = parseFloat(contributeAmount)
              if (isNaN(amount) || amount <= 0) {
                toast.error("Enter a positive amount")
                return
              }
              contributeMutation.mutate({ id: contributing!.id, amount })
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Current</span>
              <span className="font-semibold">{formatIDR(contributing?.savedAmount ?? 0)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contributeAmount">Amount to add (Rp)</Label>
              <Input
                id="contributeAmount"
                type="number"
                min="1"
                placeholder="500000"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const g = contributing!
                  const remaining = g.targetAmount - g.savedAmount
                  if (remaining > 0) {
                    setContributeAmount(remaining.toString())
                    toast.info(`Filled to target: ${formatIDR(remaining)}`)
                  }
                }}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Fill to target
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={contributeMutation.isPending}
              >
                {contributeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
