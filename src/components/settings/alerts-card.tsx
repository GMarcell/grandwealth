"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BellRing, Loader2, Save } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { apiGet } from "@/lib/api-get"
import { apiMutate, isQueuedResult } from "@/lib/api-mutate"

interface AlertSettings {
  alertsEnabled: boolean
  billReminderDays: number
  budgetAlertThreshold: number
}

const DEFAULT_SETTINGS: AlertSettings = {
  alertsEnabled: false,
  billReminderDays: 3,
  budgetAlertThreshold: 80,
}

const REMINDER_DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14]
const THRESHOLD_OPTIONS = [50, 60, 70, 80, 90, 100]

/**
 * Opt-in daily email digest: upcoming recurring bills plus budgets that have
 * reached the chosen share of their effective (rolled-over) limit.
 *
 * Alerts default to off — nothing is emailed until the switch is turned on.
 */
export function AlertsCard() {
  const queryClient = useQueryClient()

  const { data } = useQuery<AlertSettings>({
    queryKey: ["alert-settings"],
    queryFn: () => apiGet<AlertSettings>("/api/user/alerts"),
  })

  const [form, setForm] = useState<AlertSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState<AlertSettings | null>(null)

  useEffect(() => {
    if (data) {
      setForm(data)
      setSaved(data)
    }
  }, [data])

  const dirty =
    saved != null &&
    (form.alertsEnabled !== saved.alertsEnabled ||
      form.billReminderDays !== saved.billReminderDays ||
      form.budgetAlertThreshold !== saved.budgetAlertThreshold)

  const saveMutation = useMutation({
    mutationFn: (settings: AlertSettings) =>
      apiMutate("/api/user/alerts", { method: "PATCH", body: settings }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["alert-settings"] })
      toast[isQueuedResult(result) ? "info" : "success"](
        isQueuedResult(result)
          ? "Saved offline — will sync when you reconnect"
          : form.alertsEnabled
            ? "Email alerts enabled"
            : "Email alerts turned off",
      )
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Failed to update alerts",
      ),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Email Alerts
        </CardTitle>
        <CardDescription>
          A daily email showing recurring bills that are due soon and budgets
          nearing their limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="alertsEnabled" className="text-sm font-medium">
              Send me daily alerts
            </Label>
            <p className="text-xs text-muted-foreground">
              Sent once a day, and only when something actually needs your
              attention. Each bill and each budget warning is emailed only once.
            </p>
          </div>
          <Switch
            id="alertsEnabled"
            checked={form.alertsEnabled}
            onCheckedChange={(value) =>
              setForm((prev) => ({ ...prev, alertsEnabled: value }))
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billReminderDays">Bill reminder window</Label>
            <Select
              value={form.billReminderDays.toString()}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  billReminderDays: parseInt(value),
                }))
              }
              disabled={!form.alertsEnabled}
            >
              <SelectTrigger id="billReminderDays">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_DAY_OPTIONS.map((days) => (
                  <SelectItem key={days} value={days.toString()}>
                    {days} day{days === 1 ? "" : "s"} ahead
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Recurring expenses due within this window are listed in the email.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetAlertThreshold">Budget warning at</Label>
            <Select
              value={form.budgetAlertThreshold.toString()}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  budgetAlertThreshold: parseInt(value),
                }))
              }
              disabled={!form.alertsEnabled}
            >
              <SelectTrigger id="budgetAlertThreshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_OPTIONS.map((percent) => (
                  <SelectItem key={percent} value={percent.toString()}>
                    {percent}% of budget
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Uses your effective limit, including any rolled-over amount.
              Over-budget categories are always included.
            </p>
          </div>
        </div>

        {form.alertsEnabled && (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Alerts are emailed to your account address. Delivery requires an
            email provider to be configured on the server.
          </p>
        )}

        {dirty && (
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save Alert Settings
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
