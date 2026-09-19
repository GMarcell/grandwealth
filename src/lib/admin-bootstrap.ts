import type { Role } from "@prisma/client"

/**
 * Accounts listed here (comma-separated in the ADMIN_EMAILS env var) are
 * automatically granted the ADMIN role — at registration and at every
 * successful sign-in. This is how the very first administrator is bootstrapped:
 *
 *   ADMIN_EMAILS="you@example.com"
 *
 * Once an admin exists, they can promote further admins from the admin panel.
 */
export function isBootstrapAdminEmail(email: string): boolean {
  const list =
    process.env.ADMIN_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? []
  return list.includes(email.toLowerCase())
}

export function toAdminRoleIfBootstrap(email: string): Role | undefined {
  return isBootstrapAdminEmail(email) ? "ADMIN" : undefined
}
