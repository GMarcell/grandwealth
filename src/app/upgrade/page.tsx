import Link from "next/link"
import { Wallet, Check, Crown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PLAN_FEATURES, PRO_PRICE_IDR } from "@/lib/subscription"
import { formatIDR } from "@/lib/utils"

/**
 * Paywall page — shown to Free users who try to open a Pro-only module.
 * Subscriptions are admin-managed today, so the CTA is to reach out rather
 * than to check out online.
 */
export default function UpgradePage() {
  const freeFeatures = PLAN_FEATURES.filter((f) => !f.proOnly)
  const proFeatures = PLAN_FEATURES.filter((f) => f.proOnly)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Crown className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Upgrade to Pro</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          The page you tried to open is part of the Pro plan. Upgrade to unlock
          budgeting, investments, automation, and AI analysis.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              Free
            </CardTitle>
            <CardDescription>Everything you need for basic tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {freeFeatures.map((f) => (
                <li key={f.name} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground"> — {f.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="relative border-primary/40 bg-primary/5">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
            PRO
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Pro
            </CardTitle>
            <CardDescription>
              {formatIDR(PRO_PRICE_IDR)}/month — everything GrandWealth offers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {proFeatures.map((f) => (
                <li key={f.name} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground"> — {f.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Subscriptions are activated by an administrator. To subscribe, reach
            out to your account administrator or{" "}
            <Link href="/settings" className="font-medium text-primary hover:underline">
              visit Settings
            </Link>{" "}
            to see your current plan.
          </p>
          <p className="text-center">
            <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
              ← Back to dashboard
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
