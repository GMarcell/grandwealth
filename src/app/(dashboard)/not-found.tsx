import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Page Not Found",
}

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The dashboard page you&apos;re looking for doesn&apos;t exist or has
          been moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
