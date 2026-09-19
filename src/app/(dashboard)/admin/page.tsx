"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Users,
  Crown,
  Banknote,
  ShieldAlert,
  Gift,
  Loader2,
  Search,
  Trash2,
  Shield,
  ShieldOff,
  Ban,
  CheckCircle2,
  Pencil,
  KeyRound,
  Check,
  X,
  Clock,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { formatDate, formatCompactIDR } from "@/lib/utils"
import { proTrialPeriodEnd, subscriptionStatusLabel } from "@/lib/subscription"
import { DEFAULT_PASSWORD } from "@/lib/password"

type Plan = "FREE" | "PRO"
type Role = "USER" | "ADMIN"
type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED"

interface AdminUser {
  id: string
  name: string | null
  email: string
  role: Role
  plan: Plan
  subscriptionStatus: SubscriptionStatus | null
  currentPeriodEnd: string | null
  isTrial: boolean
  suspended: boolean
  createdAt: string
  _count: { transactions: number }
}

interface Overview {
  totalUsers: number
  freeUsers: number
  proUsers: number
  proActive: number
  onTrial: number
  proLapsed: number
  suspended: number
  newThisMonth: number
  potentialMrr: number
  pricePerMonth: number
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

interface AdminTrialRequest {
  id: string
  status: "PENDING" | "APPROVED" | "DECLINED"
  message: string | null
  decisionNote: string | null
  createdAt: string
  decidedAt: string | null
  user: {
    id: string
    name: string | null
    email: string
    plan: Plan
    currentPeriodEnd: string | null
    isTrial: boolean
    suspended: boolean
  }
}

const STATUS_OPTIONS: SubscriptionStatus[] = ["ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"]

function toDateInputValue(iso: string | null): string {
  if (!iso) return ""
  return iso.slice(0, 10)
}

export default function AdminPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [planFilter, setPlanFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [suspendedFilter, setSuspendedFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  // Editing dialog state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editPlan, setEditPlan] = useState<Plan>("FREE")
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>("ACTIVE")
  const [editPeriodEnd, setEditPeriodEnd] = useState("")
  const [editIsTrial, setEditIsTrial] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)

  // Reset-password dialog state
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null)

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
    queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    // Prefix-matches the pending-count query used by the sidebar badge too.
    queryClient.invalidateQueries({ queryKey: ["admin-trial-requests"] })
  }

  const { data: overview } = useQuery<Overview>({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview")
      if (!res.ok) throw new Error("Failed to load overview")
      return res.json()
    },
  })

  const params = new URLSearchParams({ page: String(page), pageSize: "20" })
  if (debouncedSearch) params.set("search", debouncedSearch)
  if (planFilter !== "all") params.set("plan", planFilter)
  if (roleFilter !== "all") params.set("role", roleFilter)
  if (statusFilter !== "all") params.set("status", statusFilter)
  if (suspendedFilter !== "all") params.set("suspended", suspendedFilter)

  const { data: usersData, isLoading: usersLoading } = useQuery<{
    data: AdminUser[]
    pagination: Pagination
  }>({
    queryKey: ["admin-users", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load users")
      return res.json()
    },
  })

  const { data: trialRequestsData } = useQuery<{
    data: AdminTrialRequest[]
    pagination: Pagination
  }>({
    queryKey: ["admin-trial-requests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/trial-requests?status=PENDING&pageSize=20")
      if (!res.ok) throw new Error("Failed to load trial requests")
      return res.json()
    },
  })

  const decideTrialMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APPROVED" | "DECLINED" }) => {
      const res = await fetch(`/api/admin/trial-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update trial request" }))
        throw new Error(err.error || "Failed to update trial request")
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      invalidateAll()
      toast.success(
        variables.status === "APPROVED"
          ? "Trial approved — the user has 30 days of Pro"
          : "Trial request declined"
      )
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update trial request"),
  })

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update user" }))
        throw new Error(err.error || "Failed to update user")
      }
      return res.json()
    },
    onSuccess: () => {
      invalidateAll()
      toast.success("User updated")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update user"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete user" }))
        throw new Error(err.error || "Failed to delete user")
      }
      return res.json()
    },
    onSuccess: () => {
      invalidateAll()
      toast.success("User deleted")
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete user"),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to reset password" }))
        throw new Error(err.error || "Failed to reset password")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(`Password reset to the default (${DEFAULT_PASSWORD})`)
      setResettingUser(null)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to reset password"),
  })

  function openEdit(user: AdminUser) {
    setEditingUser(user)
    setEditPlan(user.plan)
    setEditStatus(user.subscriptionStatus ?? "ACTIVE")
    setEditPeriodEnd(toDateInputValue(user.currentPeriodEnd))
    setEditIsTrial(user.isTrial)
  }

  async function savePlan() {
    if (!editingUser) return
    setIsSavingPlan(true)
    try {
      await patchMutation.mutateAsync({
        id: editingUser.id,
        body: {
          plan: editPlan,
          ...(editPlan === "PRO"
            ? {
                subscriptionStatus: editStatus,
                currentPeriodEnd: editPeriodEnd ? `${editPeriodEnd}T23:59:59.999Z` : null,
                isTrial: editIsTrial,
              }
            : {}),
        },
      })
      setEditingUser(null)
    } finally {
      setIsSavingPlan(false)
    }
  }

  const stats: Array<{
    label: string
    value: string | number
    sub?: string
    icon: LucideIcon
  }> = [
    {
      label: "Total users",
      value: overview?.totalUsers ?? "—",
      sub: overview ? `+${overview.newThisMonth} this month` : undefined,
      icon: Users,
    },
    {
      label: "Pro (paying)",
      value: overview?.proActive ?? "—",
      icon: Crown,
    },
    {
      label: "On trial",
      value: overview?.onTrial ?? "—",
      icon: Gift,
    },
    {
      label: "Potential MRR",
      value: overview ? formatCompactIDR(overview.potentialMrr) : "—",
      icon: Banknote,
    },
    {
      label: "Suspended",
      value: overview?.suspended ?? "—",
      icon: ShieldAlert,
    },
  ]

  const users = usersData?.data ?? []
  const pagination = usersData?.pagination
  const pendingTrialRequests = trialRequestsData?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage users and subscriptions
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold leading-tight">{stat.value}</p>
                  {stat.sub && (
                    <p className="truncate text-xs text-muted-foreground">{stat.sub}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trial requests */}
      <Card className={pendingTrialRequests.length > 0 ? "border-primary/40" : undefined}>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Gift className="h-4 w-4" />
                Trial requests
              </p>
              <p className="text-xs text-muted-foreground">
                Users asking for the free 30-day Pro trial. Approving grants Pro
                immediately; the account returns to Free when the trial ends.
              </p>
            </div>
            {pendingTrialRequests.length > 0 && (
              <Badge className="gap-1">
                <Clock className="h-3 w-3" />
                {pendingTrialRequests.length} pending
              </Badge>
            )}
          </div>

          {pendingTrialRequests.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              No pending trial requests.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendingTrialRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">
                      {request.user.name || "Unnamed"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {request.user.email}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested {formatDate(request.createdAt)}
                    </p>
                    {request.message && (
                      <p className="text-sm text-muted-foreground italic">
                        “{request.message}”
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      disabled={decideTrialMutation.isPending}
                      onClick={() =>
                        decideTrialMutation.mutate({ id: request.id, status: "APPROVED" })
                      }
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decideTrialMutation.isPending}
                      onClick={() =>
                        decideTrialMutation.mutate({ id: request.id, status: "DECLINED" })
                      }
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  // Debounce the actual query.
                  window.setTimeout(() => {
                    setDebouncedSearch(e.target.value)
                    setPage(1)
                  }, 300)
                }}
              />
            </div>
            <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{subscriptionStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={suspendedFilter} onValueChange={(v) => { setSuspendedFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Active & suspended</SelectItem>
                <SelectItem value="false">Active only</SelectItem>
                <SelectItem value="true">Suspended only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Joined</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                )}
                {!usersLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b last:border-0 ${user.suspended ? "opacity-60" : ""}`}
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {user.name || "Unnamed"}
                            {user.suspended && (
                              <Badge variant="destructive" className="ml-2">Suspended</Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-1">
                        {user.plan === "PRO" ? (
                          <Badge className="gap-1">
                            <Crown className="h-3 w-3" /> Pro
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Free</Badge>
                        )}
                        {user.plan === "PRO" && user.isTrial && (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Gift className="h-3 w-3" /> Trial
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {user.plan === "PRO" ? (
                        <Badge
                          variant={user.subscriptionStatus === "ACTIVE" ? "profit" : "loss"}
                        >
                          {subscriptionStatusLabel(user.subscriptionStatus)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {user.role === "ADMIN" ? (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" /> Admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">User</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title="Edit plan"
                          onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit {user.email}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={user.suspended ? "Unsuspend" : "Suspend"}
                          disabled={patchMutation.isPending}
                          onClick={() =>
                            patchMutation.mutate({
                              id: user.id,
                              body: { suspended: !user.suspended },
                            })
                          }
                        >
                          {user.suspended
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <Ban className="h-4 w-4" />}
                          <span className="sr-only">{user.suspended ? "Unsuspend" : "Suspend"} {user.email}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={user.role === "ADMIN" ? "Remove admin" : "Make admin"}
                          disabled={patchMutation.isPending}
                          onClick={() =>
                            patchMutation.mutate({
                              id: user.id,
                              body: { role: user.role === "ADMIN" ? "USER" : "ADMIN" },
                            })
                          }
                        >
                          {user.role === "ADMIN"
                            ? <ShieldOff className="h-4 w-4" />
                            : <Shield className="h-4 w-4" />}
                          <span className="sr-only">Toggle admin for {user.email}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Reset password"
                          onClick={() => setResettingUser(user)}
                        >
                          <KeyRound className="h-4 w-4" />
                          <span className="sr-only">Reset password for {user.email}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-600 hover:text-red-600"
                          title="Delete user"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete ${user.email}? This permanently removes their account and ALL their data. This cannot be undone.`
                              )
                            ) {
                              deleteMutation.mutate(user.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {user.email}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                {pagination.total} users
              </p>
              <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>

      {/* Reset password dialog */}
      <Dialog
        open={!!resettingUser}
        onOpenChange={(open) => !open && setResettingUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Reset password
            </DialogTitle>
            <DialogDescription>
              {resettingUser
                ? `${resettingUser.name || "User"} · ${resettingUser.email}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The password will be reset to the default below. Share it with the
              user, and ask them to change it from Settings after signing in.
            </p>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">New password</p>
              <p className="font-mono text-sm font-medium">{DEFAULT_PASSWORD}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setResettingUser(null)}
                disabled={resetPasswordMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  resettingUser && resetPasswordMutation.mutate(resettingUser.id)
                }
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit plan dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit subscription</DialogTitle>
            <DialogDescription>
              {editingUser
                ? `${editingUser.name || "User"} · ${editingUser.email}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={editPlan}
                onValueChange={(v) => setEditPlan(v as Plan)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="PRO">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>                {editPlan === "PRO" && (
                  <>
                    <div className="space-y-2">
                      <Label>Subscription status</Label>
                      <Select
                        value={editStatus}
                        onValueChange={(v) => setEditStatus(v as SubscriptionStatus)}
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {subscriptionStatusLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Users are entitled to Pro only while the status is Active.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Current period ends (optional)</Label>
                      <Input
                        type="date"
                        value={editPeriodEnd}
                        onChange={(e) => setEditPeriodEnd(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty for no end date. After this date the user
                        automatically loses Pro access.
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="edit-trial" className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-muted-foreground" />
                          Free trial grant
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Trial grants are excluded from MRR. Off = paid
                          subscription. Trial access ends at the period end date
                          above.
                        </p>
                      </div>
                      <Switch
                        id="edit-trial"
                        checked={editIsTrial}
                        onCheckedChange={(checked) => {
                          setEditIsTrial(checked)
                          // Default a trial grant to the standard trial length
                          // (30 days) so the admin only has to confirm.
                          if (checked && !editPeriodEnd) {
                            setEditPeriodEnd(toDateInputValue(proTrialPeriodEnd().toISOString()))
                          }
                        }}
                      />
                    </div>
                  </>
                )}

            {editPlan === "FREE" && (
              <p className="text-sm text-muted-foreground">
                Downgrading clears the user&apos;s subscription — they will keep
                their data but lose access to Pro features immediately.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button onClick={savePlan} disabled={isSavingPlan}>
                {isSavingPlan && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
