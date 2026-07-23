import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

/**
 * Reusable auth guard for Next.js server components (pages & layouts).
 *
 * Calls `auth()` and redirects to `/login` if the user is not authenticated.
 * This provides defense-in-depth at the component level — the middleware
 * handles auth at the edge first, but this guarantees protection even if
 * the middleware is ever bypassed.
 *
 * @param callbackUrl - Optional path to return to after login.
 *                      Defaults to the pathname if provided, otherwise omitted.
 * @returns The authenticated user's ID (string).
 *
 * @example
 * ```tsx
 * export default async function Page() {
 *   const userId = await requireAuth()
 *   // userId is guaranteed to exist
 * }
 * ```
 */
export async function requireAuth(callbackUrl?: string): Promise<string> {
  const session = await auth()

  if (!session?.user?.id) {
    const url = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login"
    redirect(url)
  }

  return session.user.id
}
