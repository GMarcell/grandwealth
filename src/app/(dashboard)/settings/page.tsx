"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { categoryFormSchema } from "@/lib/validation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sun,
  Moon,
  User,
  Mail,
  Palette,
  Plus,
  AlertTriangle,
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
  KeyRound,
} from "lucide-react";
import {
  getBudgetMonthLabel,
  getCurrentBudgetMonthKey,
} from "@/lib/budget-months";
import { RULE_TYPE_ORDER, RULE_TYPE_CONFIGS } from "@/lib/rule-type";
import { CHART_COLORS } from "@/lib/chart-colors";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { FormError } from "@/components/ui/form-error";
import { toast } from "sonner";
import { SubscriptionCard } from "@/components/settings/subscription-card";
import { TrialRequestCard } from "@/components/settings/trial-request-card";

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  ruleType: string | null;
}

type CategoryFormData = z.infer<typeof categoryFormSchema>;

const PREDEFINED_EXPENSE_CATEGORIES = [
  "FOOD",
  "TRANSPORTATION",
  "HOUSING",
  "UTILITIES",
  "HEALTHCARE",
  "EDUCATION",
  "ENTERTAINMENT",
  "SHOPPING",
  "TRAVEL",
  "INSURANCE",
  "TAX",
  "SUBSCRIPTION",
  "OTHER_EXPENSE",
];

const PREDEFINED_INCOME_CATEGORIES = [
  "SALARY",
  "FREELANCE",
  "BUSINESS",
  "INVESTMENT",
  "DIVIDEND",
  "INTEREST",
  "RENTAL",
  "GIFT",
  "REFUND",
  "OTHER_INCOME",
];

/** Category color picker options (same as shared chart palette). */
const COLOR_OPTIONS = [...CHART_COLORS];

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: budgetSettings } = useQuery<{
    budgetStartDay: number;
    carryOverEnabled: boolean;
  }>({
    queryKey: ["budget-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user/budget-settings");
      if (!res.ok) throw new Error("Failed to fetch budget settings");
      return res.json();
    },
  });

  const [budgetStartDay, setBudgetStartDay] = useState(1);
  const [carryOverEnabled, setCarryOverEnabled] = useState(true);
  const [settingsChanged, setSettingsChanged] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (
    budgetSettings &&
    !settingsChanged &&
    budgetStartDay !== budgetSettings.budgetStartDay
  ) {
    setBudgetStartDay(budgetSettings.budgetStartDay);
  }

  if (
    budgetSettings &&
    !settingsChanged &&
    carryOverEnabled !== budgetSettings.carryOverEnabled
  ) {
    setCarryOverEnabled(budgetSettings.carryOverEnabled);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateBudgetSettingsMutation = useMutation({
    mutationFn: (data: { budgetStartDay: number; carryOverEnabled: boolean }) =>
      fetch("/api/user/budget-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-settings"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["rollover-history"] });
      toast.success("Budget settings updated");
      setSettingsChanged(false);
    },
    onError: () => toast.error("Failed to update budget settings"),
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to update password" }));
        throw new Error(err.error || "Failed to update password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to update password",
      ),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created");
      resetForm();
    },
    onError: () => toast.error("Failed to create category"),
  });

  const updateRuleTypeMutation = useMutation({
    mutationFn: ({ id, ruleType }: { id: string; ruleType: string | null }) =>
      fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleType }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Rule type updated");
    },
    onError: () => toast.error("Failed to update rule type"),
  });

  const upsertRuleTypeMutation = useMutation({
    mutationFn: async ({
      name,
      type,
      ruleType,
    }: {
      name: string;
      type: string;
      ruleType: string | null;
    }) => {
      const existing = userCategories.find((c) => c.name === name);
      if (existing) {
        const res = await fetch(`/api/categories/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleType }),
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Failed to update" }));
          throw new Error(err.error || "Failed to update rule type");
        }
        return res.json();
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            type,
            color: type === "INCOME" ? "#10b981" : "#6366f1",
            ruleType,
          }),
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Failed to create" }));
          throw new Error(err.error || "Failed to create category");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Rule type updated");
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to update rule type",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to delete account" }));
        throw new Error(err.error || "Failed to delete account");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      toast.success("Account deleted. Redirecting...");
      // Clear React Query cache and sign out
      queryClient.clear();
      setTimeout(() => signOut({ callbackUrl: "/" }), 1500);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to delete account",
      ),
  });

  function resetForm() {
    reset({ name: "", type: "EXPENSE", color: "#6366f1" });
    setIsDialogOpen(false);
  }

  function onPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    updatePasswordMutation.mutate({ currentPassword, newPassword });
  }

  function onFormSubmit(data: CategoryFormData) {
    createMutation.mutate({
      name: data.name.toUpperCase().replace(/\s+/g, "_"),
      type: data.type,
      color: data.color,
    });
  }

  const userCategories = categories ?? [];
  const userExpenseCategories = userCategories.filter(
    (c) => c.type === "EXPENSE",
  );
  const userIncomeCategories = userCategories.filter(
    (c) => c.type === "INCOME",
  );

  const RULE_TYPE_ICONS: Record<string, React.ElementType> = {
    NEED: Home,
    WANT: Sparkles,
    SAVINGS: PiggyBank,
  };

  function RuleTypeSelectItems() {
    return (
      <>
        {RULE_TYPE_ORDER.map((type) => {
          const cfg = RULE_TYPE_CONFIGS[type];
          const Icon = RULE_TYPE_ICONS[type];
          return (
            <SelectItem key={type} value={type} className="text-xs">
              <div className="flex items-center gap-1">
                <Icon className={`h-3 w-3 ${cfg.color}`} />
                {cfg.label}
              </div>
            </SelectItem>
          );
        })}
        <SelectItem value="" className="text-xs text-muted-foreground">
          None
        </SelectItem>
      </>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Plan & Subscription */}
      <SubscriptionCard />

      {/* Pro trial request */}
      <TrialRequestCard />

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>
            Change the password you use to sign in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty only if you signed up without a password (e.g. via
                a social provider) and are setting one for the first time.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={updatePasswordMutation.isPending}
            >
              {updatePasswordMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Update Password
            </Button>
          </form>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Select
                value={budgetStartDay.toString()}
                onValueChange={(v) => {
                  setBudgetStartDay(parseInt(v));
                  setSettingsChanged(true);
                }}
              >
                <SelectTrigger className="w-full sm:w-28">
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
                  : `Budget months run from the ${budgetStartDay}th of the previous month to the ${budgetStartDay - 1}th, and are named after the month they end in`}
              </p>
            </div>
          </div>

          {budgetStartDay > 1 && budgetSettings && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="text-muted-foreground">
                Example: With this setting,{" "}
                <span className="font-medium text-foreground">
                  {getBudgetMonthLabel(
                    getCurrentBudgetMonthKey(budgetStartDay),
                    budgetStartDay,
                    true,
                  )}
                </span>
              </p>
            </div>
          )}

          {/* Global carry-over switch */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="carryOver" className="text-sm font-medium">
                Carry over unused budget
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically roll each month&apos;s unused budget into the next
                month. This only changes your budget limits — it never creates
                income or transactions, so it doesn&apos;t affect net wealth.
              </p>
            </div>
            <Switch
              id="carryOver"
              checked={carryOverEnabled}
              onCheckedChange={(value) => {
                setCarryOverEnabled(value);
                setSettingsChanged(true);
              }}
            />
          </div>

          {settingsChanged && (
            <Button
              size="sm"
              onClick={() =>
                updateBudgetSettingsMutation.mutate({
                  budgetStartDay,
                  carryOverEnabled,
                })
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
              variant={
                !mounted ? "outline" : theme === "light" ? "default" : "outline"
              }
              onClick={() => setTheme("light")}
              className="flex-1"
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </Button>
            <Button
              variant={
                !mounted ? "outline" : theme === "dark" ? "default" : "outline"
              }
              onClick={() => setTheme("dark")}
              className="flex-1"
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </Button>
            <Button
              variant={
                !mounted
                  ? "outline"
                  : theme === "system"
                    ? "default"
                    : "outline"
              }
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
                <DialogTitle>Create Category</DialogTitle>
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
                          variant={
                            field.value === "INCOME" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => field.onChange("INCOME")}
                          className="flex-1"
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Income
                        </Button>
                        <Button
                          type="button"
                          variant={
                            field.value === "EXPENSE" ? "default" : "outline"
                          }
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
                const userCat = userExpenseCategories.find(
                  (c) => c.name === cat,
                );
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
                );
              })}
              {userExpenseCategories
                .filter(
                  (cat) =>
                    ![
                      ...PREDEFINED_EXPENSE_CATEGORIES,
                      ...PREDEFINED_INCOME_CATEGORIES,
                    ].includes(cat.name),
                )
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
                            deleteMutation.mutate(cat.id);
                          }
                        }}
                        className="hover:opacity-70"
                        aria-label={`Delete ${cat.name} category`}
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
                const userCat = userIncomeCategories.find(
                  (c) => c.name === cat,
                );
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
                );
              })}
              {userIncomeCategories.map((cat) => {
                const isPredefined = [
                  ...PREDEFINED_INCOME_CATEGORIES,
                  ...PREDEFINED_EXPENSE_CATEGORIES,
                ].includes(cat.name);
                if (isPredefined) return null;
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
                            deleteMutation.mutate(cat.id);
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
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                Delete Account
              </p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                Permanently delete your account and all associated data —
                transactions, categories, budgets, gold holdings, stocks,
                recurring transactions, and bank savings. This action cannot be
                undone.
              </p>
            </div>
            <Dialog
              open={isDeleteDialogOpen}
              onOpenChange={setIsDeleteDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete My Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    Delete Account
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 p-3 text-sm">
                    <p className="font-medium text-red-800 dark:text-red-300">
                      This will permanently remove:
                    </p>
                    <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-400 mt-2 space-y-1">
                      <li>All transactions and recurring transactions</li>
                      <li>All budgets and categories</li>
                      <li>Gold holdings and stock portfolio records</li>
                      <li>Bank savings records</li>
                      <li>Monthly analysis reports</li>
                      <li>Your account and session</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to continue? This cannot be undone.
                  </p>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsDeleteDialogOpen(false)}
                      disabled={deleteAccountMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteAccountMutation.mutate()}
                      disabled={deleteAccountMutation.isPending}
                    >
                      {deleteAccountMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete My Account
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
