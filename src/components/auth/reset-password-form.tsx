"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
        <p className="text-sm font-medium">Missing reset token</p>
        <p className="text-xs text-muted-foreground mt-1">
          This link is invalid. Request a new one from the forgot password page.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password") as string
    const confirm = formData.get("confirm") as string

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    if (password !== confirm) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json().catch(() => ({ error: "Something went wrong" }))

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        return
      }

      setDone(true)
      setTimeout(() => router.push("/login"), 1800)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
        <p className="text-sm font-medium">Password updated!</p>
        <p className="text-xs text-muted-foreground mt-1">
          Redirecting you to sign in…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="At least 6 characters"
          required
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          placeholder="Repeat your new password"
          required
          disabled={isLoading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        Reset Password
      </Button>
    </form>
  )
}
