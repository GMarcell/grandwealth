import { DashboardContent } from "@/components/dashboard/dashboard-content"

/**
 * Dashboard page — server component shell.
 *
 * The static header is rendered on the server for instant HTML delivery.
 * All data-fetching and interactive content lives in the client DashboardContent component,
 * which keeps the client JS bundle lean and allows the header to be streamed immediately.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Static header — server-rendered, no JS needed */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your complete wealth overview
          </p>
        </div>
      </div>

      {/* Data-driven content — client component, loaded after hydration */}
      <DashboardContent />
    </div>
  )
}
