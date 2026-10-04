import { timingSafeEqual } from "crypto"

/**
 * Verify the shared secret a cron caller presents.
 *
 * Only the `Authorization: Bearer <secret>` header is accepted. The previous
 * implementation also accepted `?secret=`, which leaks the secret into access
 * logs, browser history, and referrers; Vercel Cron and standard cron agents
 * (curl `-H`) both send the header.
 *
 * The comparison is constant-time so an attacker cannot recover the secret
 * byte-by-byte from response timing. Length is compared first because
 * `timingSafeEqual` throws on mismatched lengths — the expected length is not
 * secret, so this reveals nothing useful.
 */
export function verifyCronSecret(
  authorizationHeader: string | null,
  expectedSecret: string,
): boolean {
  if (!authorizationHeader?.startsWith("Bearer ")) return false

  const provided = Buffer.from(authorizationHeader.slice("Bearer ".length))
  const expected = Buffer.from(expectedSecret)

  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}
