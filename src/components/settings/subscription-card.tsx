"use client"

import Link from "next/link"
import { Crown, Gift, ShieldCheck } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { planLabel, subscriptionStatusLabel } from "@/lib/subscription"

interface SubscriptionState {
  role: "USER" | "ADMIN"
  plan: "FREE" | "PRO"
  subscriptionStatus: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | null
  currentPeriodEnd: string | null
  isTrial: boolean
  suspended: boolean
  isPro: boolean
  isAdmin: boolean
}

export function SubscriptionCard() {
  const { data, isLoading } = useQuery<SubscriptionState>({
    queryKey: ["user-subscription"],
    queryFn: async () => {
      const res = await fetch("/api/user/subscription")
      if (!res.ok) throw new Error("Failed to fetch subscription")
      return res.json()
    },
  })

  const isPro = data?.isPro ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Plan & Subscription
        </CardTitle>
        <CardDescription>
          Your current GrandWealth plan and billing status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isLoading ? (
            <Badge variant="secondary">Loading…</Badge>
          ) : isPro ? (
            <Badge className="gap-1 bg-primary text-primary-foreground">
              <Crown className="h-3 w-3" />
              {planLabel(data?.plan ?? "FREE")}
            </Badge>
          ) : (
            <Badge variant="secondary">{planLabel(data?.plan ?? "FREE")}</Badge>
          )}

          {!isLoading && data?.isAdmin && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Administrator
            </Badge>
          )}

          {!isLoading && data?.isTrial && (
            <Badge variant="outline" className="gap-1">
              <Gift className="h-3 w-3" />
              Trial
            </Badge>
          )}

          {!isLoading && data?.plan === "PRO" && data.subscriptionStatus && (
            <Badge
              variant={data.subscriptionStatus === "ACTIVE" ? "default" : "secondary"}
            >
              {subscriptionStatusLabel(data.subscriptionStatus)}
            </Badge>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">
              {data?.isTrial ? "Trial ends" : "Current period ends"}
            </dt>
            <dd className="font-medium">
              {data?.currentPeriodEnd
                ? formatDate(data.currentPeriodEnd)
                : data?.plan === "PRO"
                  ? "No end date set"
                  : "—"}
            </dd>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Role</dt>
            <dd className="font-medium capitalize">
              {data?.role.toLowerCase() ?? "—"}
            </dd>
          </div>
        </dl>

        {data?.isPro && data?.isTrial && (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            You&apos;re enjoying a free trial of Pro — it ends on{" "}
            {data.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : "the date above"}. To
            keep Pro after the trial, ask your administrator to activate your
            subscription.
          </p>
        )}

        {!isLoading && data && !data.isPro && data.plan === "PRO" && data.isTrial && (
          <p className="rounded-lg bg-destructive/10 p-3 text-xs text-muted-foreground">
            Your free trial has ended. To keep using the Pro modules, ask your
            administrator to activate your subscription.
          </p>
        )}

        {!isPro && (
          <Button asChild size="sm" variant="outline">
            <Link href="/upgrade">
              <Crown className="h-4 w-4 mr-1" />
              See what Pro includes
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
