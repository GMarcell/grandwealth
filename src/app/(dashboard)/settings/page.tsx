"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { categoryFormSchema } from "@/lib/validation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import {
  Sun,
  Moon,
  User,
  Mail,
  Palette,
  Plus,
  Trash2,
  Loader2,
  Tag,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Save,
  Home,
  Sparkles,
  PiggyBank,
} from "lucide-react"
import { getBudgetMonthLabel } from "@/lib/budget-months"
import { RULE_TYPE_ORDER, RULE_TYPE_CONFIGS } from "@/lib/rule-type"
import { FormError } from "@/components/ui/form-error"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
  type: string
  color: string
  ruleType: string | null
}

type CategoryFormData = z.infer<typeof categoryFormSchema>

const PREDEFINED_EXPENSE_CATEGORIES = [
  "FOOD", "TRANSPORTATION", "HOUSING", "UTILITIES", "HEALTHCARE",
  "EDUCATION", "ENTERTAINMENT", "SHOPPING", "TRAVEL", "INSURANCE",
  "TAX", "SUBSCRIPTION", "OTHER_EXPENSE",
]

const PREDEFINED_INCOME_CATEGORIES = [
  "SALARY", "FREELANCE", "BUSINESS", "INVESTMENT", "DIVIDEND",
  "INTEREST", "RENTAL", "GIFT", "REFUND", "OTHER_INCOME",
]

const COLOR_OPTIONS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
  "#a855f7", "#e11d48", "#0ea5e9", "#6366f1",
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()

  const [mounted, setMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const {
    register,
    handleSubmit: formSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      type: "EXPENSE",
      color: "#6366f1",
    },
  })

  const formType = watch("type")
  const formColor = watch("color")

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
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

  const [budgetStartDay, setBudgetStartDay] = useState(1)
  const [settingsChanged, setSettingsChanged] = useState(false)

  if (budgetSettings && !settingsChanged && budgetStartDay !== budgetSettings.budgetStartDay) {
    setBudgetStartDay(budgetSettings.budgetStartDay)
  }

  useEffect(() => { setMounted(true) }, [])

  const updateBudgetSettingsMutation = useMutation({
    mutationFn: (data: { budgetStartDay: number }) =>
      fetch("/api/user/budget-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-settings"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Budget settings updated")
      setSettingsChanged(false)
    },
    onError: () => toast.error("Failed to update budget settings"),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Category created")
      resetForm()
    },
    onError: () => toast.error("Failed to create category"),
  })

  const updateRuleTypeMutation = useMutation({
    mutationFn: ({ id, ruleType }: { id: string; ruleType: string | null }) =>
      fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleType }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Rule type updated")
    },
    onError: () => toast.error("Failed to update rule type"),
  })

  const upsertRuleTypeMutation = useMutation({
    mutationFn: async ({ name, type, ruleType }: { name: string; type: string; ruleType: string | null }) => {
      const existing = userCategories.find((c) => c.name === name)
      if (existing) {
        const res = await fetch(`/api/categories/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleType }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to update" }))
          throw new Error(err.error || "Failed to update rule type")
        }
        return res.json()
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, color: type === "INCOME" ? "#10b981" : "#6366f1", ruleType }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to create" }))
          throw new Error(err.error || "Failed to create category")
        }
        return res.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Rule type updated")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update rule type"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      toast.success("Category deleted")
    },
    onError: () => toast.error("Failed to delete category"),
  })

  function resetForm() {
    reset({ name: "", type: "EXPENSE", color: "#6366f1" })
    setIsDialogOpen(false)
  }

  function onFormSubmit(data: CategoryFormData) {
    createMutation.mutate({
      name: data.name.toUpperCase().replace(/\s+/g, "_"),
      type: data.type,
      color: data.color,
    })
  }

  const userCategories = categories ?? []
  const userExpenseCategories = userCategories.filter((c) => c.type === "EXPENSE")
  const userIncomeCategories = userCategories.filter((c) => c.type === "INCOME")

  const RULE_TYPE_ICONS: Record<string, React.ElementType> = {
    NEED: Home,
    WANT: Sparkles,
    SAVINGS: PiggyBank,
  }

  function RuleTypeSelectItems() {
    return (
      <>
        {RULE_TYPE_ORDER.map((type) => {
          const cfg = RULE_TYPE_CONFIGS[type]
          const Icon = RULE_TYPE_ICONS[type]
          return (
            <SelectItem key={type} value={type} className="text-xs">
              <div className="flex items-center gap-1">
                <Icon className={`h-3 w-3 ${cfg.color}`} />
                {cfg.label}
              </div>
            </SelectItem>
          )
        })}
        <SelectItem value="" className="text-xs text-muted-foreground">
          None
        </SelectItem>
      </>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {session?.user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="font-medium">{session?.user?.name || "User"}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {session?.user?.email || ""}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Cycle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Budget Cycle
          </CardTitle>
          <CardDescription>
            Set the day your budget month starts (default: 1st)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budgetStartDay">Budget Month Starts On</Label>
            <div className="flex items-center gap-3">
              <Select
                value={budgetStartDay.toString()}
                onValueChange={(v) => {
                  setBudgetStartDay(parseInt(v))
                  setSettingsChanged(true)
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                      {day === 1
                        ? "st"
                        : day === 2
                          ? "nd"
                          : day === 3
                            ? "rd"
                            : "th"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {budgetStartDay === 1
                  ? "Budget months align with calendar months"
                  : `Budget months run from the ${budgetStartDay}th to the ${budgetStartDay - 1}st of the next month`}
              </p>
            </div>
          </div>

          {budgetStartDay > 1 && budgetSettings && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="text-muted-foreground">
                Example: With this setting,{" "}
                <span className="font-medium text-foreground">
                  {getBudgetMonthLabel(
                    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
                    budgetStartDay,
                    true
                  )}
                </span>
              </p>
            </div>
          )}

          {settingsChanged && (
            <Button
              size="sm"
              onClick={() =>
                updateBudgetSettingsMutation.mutate({ budgetStartDay })
              }
              disabled={updateBudgetSettingsMutation.isPending}
            >
              {updateBudgetSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Budget Settings
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize your display settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant={!mounted ? "outline" : theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
              className="flex-1"
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </Button>
            <Button
              variant={!mounted ? "outline" : theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
              className="flex-1"
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </Button>
            <Button
              variant={!mounted ? "outline" : theme === "system" ? "default" : "outline"}
              onClick={() => setTheme("system")}
              className="flex-1"
            >
              <Palette className="h-4 w-4 mr-2" />
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Categories */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Custom Categories
            </CardTitle>
            <CardDescription>
              Create your own income and expense categories beyond the defaults
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-1" />
                New Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Create Category
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={formSubmit(onFormSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="catName">Category Name</Label>
                  <Input
                    id="catName"
                    placeholder="e.g., PETROL"
                    {...register("name", { required: true })}
                  />
                  <FormError errors={errors} name="name" />
                  <p className="text-xs text-muted-foreground">
                    Will be converted to UPPER_CASE format
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={field.value === "INCOME" ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange("INCOME")}
                          className="flex-1"
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Income
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "EXPENSE" ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange("EXPENSE")}
                          className="flex-1"
                        >
                          <TrendingDown className="h-4 w-4 mr-1" />
                          Expense
                        </Button>
                      </div>
                    )}
                  />
                  <FormError errors={errors} name="type" />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Controller
                    name="color"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => field.onChange(color)}
                            className={`h-8 w-8 rounded-full border-2 transition-all ${
                              field.value === color
                                ? "border-foreground scale-110"
                                : "border-transparent hover:scale-110"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  Create Category
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Expense Categories */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Expense Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_EXPENSE_CATEGORIES.map((cat) => {
                const userCat = userExpenseCategories.find((c) => c.name === cat)
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {cat.replace("_", " ")}
                    </Badge>
                    <Select
                      value={userCat?.ruleType ?? ""}
                      onValueChange={(v) =>
                        upsertRuleTypeMutation.mutate({
                          name: cat,
                          type: "EXPENSE",
                          ruleType: v || null,
                        })
                      }
                    >
                      <SelectTrigger className="h-6 w-24 text-[10px]">
                        <SelectValue placeholder="50/30/20" />
                      </SelectTrigger>
                      <SelectContent>
                        <RuleTypeSelectItems />
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
              {userExpenseCategories
                .filter((cat) => ![...PREDEFINED_EXPENSE_CATEGORIES, ...PREDEFINED_INCOME_CATEGORIES].includes(cat.name))
                .map((cat) => (
                <div key={cat.id} className="flex items-center gap-2">
                  <Badge
                    className="text-xs gap-1 group"
                    style={{
                      backgroundColor: `${cat.color}20`,
                      borderColor: cat.color,
                      color: cat.color,
                    }}
                  >
                    {cat.name.replace("_", " ")}
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${cat.name}" category?`)) {
                          deleteMutation.mutate(cat.id)
                        }
                      }}
                      className="hover:opacity-70"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                  <Select
                    value={cat.ruleType ?? ""}
                    onValueChange={(v) =>
                      updateRuleTypeMutation.mutate({
                        id: cat.id,
                        ruleType: v || null,
                      })
                    }
                  >
                    <SelectTrigger className="h-6 w-24 text-[10px]">
                      <SelectValue placeholder="50/30/20" />
                    </SelectTrigger>
                    <SelectContent>
                      <RuleTypeSelectItems />
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Income Categories */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Income Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_INCOME_CATEGORIES.map((cat) => {
                const userCat = userIncomeCategories.find((c) => c.name === cat)
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {cat.replace("_", " ")}
                    </Badge>
                    <Select
                      value={userCat?.ruleType ?? ""}
                      onValueChange={(v) =>
                        upsertRuleTypeMutation.mutate({
                          name: cat,
                          type: "INCOME",
                          ruleType: v || null,
                        })
                      }
                    >
                      <SelectTrigger className="h-6 w-24 text-[10px]">
                        <SelectValue placeholder="50/30/20" />
                      </SelectTrigger>
                      <SelectContent>
                        <RuleTypeSelectItems />
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
              {userIncomeCategories.map((cat) => {
                const isPredefined = [...PREDEFINED_INCOME_CATEGORIES, ...PREDEFINED_EXPENSE_CATEGORIES].includes(cat.name)
                if (isPredefined) return null
                return (
                  <div key={cat.id} className="flex items-center gap-2">
                    <Badge
                      className="text-xs gap-1 group"
                      style={{
                        backgroundColor: `${cat.color}20`,
                        borderColor: cat.color,
                        color: cat.color,
                      }}
                    >
                      {cat.name.replace("_", " ")}
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${cat.name}" category?`)) {
                            deleteMutation.mutate(cat.id)
                          }
                        }}
                        className="hover:opacity-70"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                    <Select
                      value={cat.ruleType ?? ""}
                      onValueChange={(v) =>
                        updateRuleTypeMutation.mutate({
                          id: cat.id,
                          ruleType: v || null,
                        })
                      }
                    >
                      <SelectTrigger className="h-6 w-24 text-[10px]">
                        <SelectValue placeholder="50/30/20" />
                      </SelectTrigger>
                      <SelectContent>
                        <RuleTypeSelectItems />
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
