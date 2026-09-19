import { ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

/**
 * Shown to suspended accounts. Static and public so it renders regardless
 * of auth state (the account can no longer sign in).
 */
export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Account suspended</CardTitle>
          <CardDescription>
            Your account has been suspended. If you believe this is a mistake,
            please contact your account administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
