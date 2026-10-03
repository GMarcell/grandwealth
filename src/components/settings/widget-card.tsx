"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Smartphone, Copy, Check, Trash2, Plus, Loader2 } from "lucide-react"
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
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"

interface WidgetToken {
  id: string
  prefix: string
  label: string
  lastUsedAt: string | null
  createdAt: string
}

/**
 * Lets a user mint read-only widget tokens for their phone's home-screen
 * widget. The plaintext token is shown exactly once, right after creation.
 */
export function WidgetCard() {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState("")
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery<{ tokens: WidgetToken[] }>({
    queryKey: ["widget-tokens"],
    queryFn: async () => {
      const res = await fetch("/api/widget/tokens")
      if (!res.ok) throw new Error("Failed to load widget tokens")
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (labelValue: string) => {
      const res = await fetch("/api/widget/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelValue || "Widget" }),
      })
      if (!res.ok) throw new Error("Failed to create widget token")
      return res.json() as Promise<{ token: string }>
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["widget-tokens"] })
      setNewToken(result.token)
      setLabel("")
      toast.success("Widget token created — copy it now")
    },
    onError: () => toast.error("Failed to create widget token"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/widget/tokens?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to revoke widget token")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget-tokens"] })
      toast.success("Widget token revoked")
    },
    onError: () => toast.error("Failed to revoke widget token"),
  })

  async function copyToken() {
    if (!newToken) return
    try {
      await navigator.clipboard.writeText(newToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy — select the token manually")
    }
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Phone Widget
        </CardTitle>
        <CardDescription>
          Add a home-screen widget showing your net cash flow, remaining budget,
          and net worth. Generate a read-only token and paste it into your widget
          app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {newToken && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-medium">
              Copy this token now — it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs">
                {newToken}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToken}
                aria-label="Copy widget token"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="widget-label">Label (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="widget-label"
              placeholder="e.g. iPhone widget"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
            />
            <Button
              onClick={() => createMutation.mutate(label)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Generate
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tokens…</p>
        ) : (data?.tokens?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No widget tokens yet.
          </p>
        ) : (
          <div className="space-y-2">
            {data!.tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {t.label}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {t.prefix}…
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Created {formatDate(t.createdAt)}
                    {t.lastUsedAt
                      ? ` · Last used ${formatDate(t.lastUsedAt)}`
                      : " · Never used"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (confirm(`Revoke "${t.label}"?`)) {
                      deleteMutation.mutate(t.id)
                    }
                  }}
                  aria-label={`Revoke ${t.label}`}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            How to set up the widget
          </summary>
          <div className="mt-3 space-y-3 text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">iOS (Scriptable)</p>
              <p className="mt-1">
                Install Scriptable, add a script that fetches{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {origin}/api/widget/data
                </code>{" "}
                with header{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  x-widget-token
                </code>
                , then add a Scriptable widget to your home screen.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">
                Android (KWGT / Tasker)
              </p>
              <p className="mt-1">
                Use an HTTP request action to the same URL with the{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  x-widget-token
                </code>{" "}
                header and bind the JSON fields to your widget.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Quick add</p>
              <p className="mt-1">
                Point a widget tap at{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {origin}/transactions?add=1
                </code>{" "}
                to open straight into adding a transaction.
              </p>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
