"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gift,
  Loader2,
  Send,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/utils"
import { PRO_TRIAL_DAYS } from "@/lib/subscription"

interface TrialRequestState {
  status: "PENDING" | "APPROVED" | "DECLINED" | null
  requestedAt: string | null
  decidedAt: string | null
  message: string | null
  onTrial: boolean
  trialEndsAt: string | null
  hasUsedTrial: boolean
  isPro: boolean
  canRequest: boolean
}

/**
 * Request a free Pro trial. Trials are admin-managed: submitting a request
 * notifies the administrators, and approving it grants PRO for
 * `PRO_TRIAL_DAYS` days before the account returns to Free automatically.
 */
export function TrialRequestCard() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")

  const { data, isLoading } = useQuery<TrialRequestState>({
    queryKey: ["trial-request"],
    queryFn: async () => {
      const res = await fetch("/api/user/trial-request")
      if (!res.ok) throw new Error("Failed to load trial request")
      return res.json()
    },
  })

  const requestMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetch("/api/user/trial-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note ? { message: note } : {}),
      })
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to submit request" }))
        throw new Error(err.error || "Failed to submit request")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trial-request"] })
      setMessage("")
      toast.success("Trial request sent — an administrator will review it")
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to submit request",
      ),
  })

  const pending = data?.status === "PENDING"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Pro Trial
        </CardTitle>
        <CardDescription>
          Try every Pro module free for {PRO_TRIAL_DAYS} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Badge variant="secondary">Loading…</Badge>
        ) : data?.onTrial ? (
          <>
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Trial active
            </Badge>
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              You have full access to every Pro module until{" "}
              <span className="font-medium text-foreground">
                {data.trialEndsAt ? formatDate(data.trialEndsAt) : "the end date"}
              </span>
              . After that your account returns to the Free plan automatically.
            </p>
          </>
        ) : data?.isPro ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Pro is active on your account — no trial needed.
          </p>
        ) : pending ? (
          <>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              Awaiting review
            </Badge>
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Your trial request was sent
              {data?.requestedAt ? ` on ${formatDate(data.requestedAt)}` : ""} and
              is waiting for an administrator to review it. You&apos;ll get an
              email once it&apos;s approved.
            </p>
          </>
        ) : data?.hasUsedTrial ? (
          <>
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Trial already used
            </Badge>
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Your free Pro trial has already been used. Ask an administrator if
              you&apos;d like to keep using the Pro modules.
            </p>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              requestMutation.mutate(message.trim())
            }}
            className="space-y-3"
          >
            {data?.status === "DECLINED" && (
              <p className="rounded-lg bg-destructive/10 p-3 text-xs text-muted-foreground">
                Your previous request was declined. You can send another one with
                more detail if your situation has changed.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Request a free {PRO_TRIAL_DAYS}-day Pro trial. An administrator
              reviews the request and unlocks Pro — after {PRO_TRIAL_DAYS} days
              your account switches back to the Free plan on its own.
            </p>
            <div className="space-y-2">
              <Label htmlFor="trialMessage">
                Why would you like Pro?{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="trialMessage"
                placeholder="e.g. I want to try budgeting and portfolio tracking"
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={requestMutation.isPending || !data?.canRequest}
            >
              {requestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Request Pro Trial
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
