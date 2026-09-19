/**
 * Password policy, shared by the self-service change endpoint, the
 * administrator reset endpoint, and the UI that calls them.
 */

/** Minimum length accepted by registration, reset and password change. */
export const PASSWORD_MIN_LENGTH = 6

/**
 * The credential an administrator assigns with
 * `POST /api/admin/users/[id]/reset-password`.
 *
 * Deliberately a known, non-secret value: the admin has to tell the user what
 * it is out-of-band. The user is expected to replace it from Settings
 * (`PATCH /api/user/password`) after signing in.
 */
export const DEFAULT_PASSWORD = "demo123456"
