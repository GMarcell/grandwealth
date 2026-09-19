import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { isProUser, type EntitlementUser } from "@/lib/subscription"
import { formatDate } from "@/lib/utils"

/** Mirrors the `TrialRequestStatus` enum in the Prisma schema. */
export type TrialRequestStatus = "PENDING" | "APPROVED" | "DECLINED"

/** The request fields the state helper cares about. */
export interface TrialRequestLike {
  status: TrialRequestStatus
  message?: string | null
  createdAt: Date | string
  decidedAt?: Date | string | null
}

/** The user fields the state helper cares about. */
export interface TrialRequestStateUser extends EntitlementUser {
  isTrial: boolean
}

export interface TrialRequestState {
  /** Status of the user's most recent request, or null if they never asked. */
  status: TrialRequestStatus | null
  requestedAt: string | null
  decidedAt: string | null
  /** The note the user attached to their most recent request. */
  message: string | null
  /** True when Pro access currently comes from an approved trial. */
  onTrial: boolean
  /** When the running trial ends (null unless `onTrial`). */
  trialEndsAt: string | null
  /** True once a trial has been approved for this account (one per account). */
  hasUsedTrial: boolean
  /** True when the user is entitled to Pro for any reason. */
  isPro: boolean
  /** True when the user may submit a new request right now. */
  canRequest: boolean
}

const toIso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

/**
 * Derive everything the Settings trial card and the request endpoint need from
 * a user row plus their requests (newest first).
 *
 * Request rules:
 * - an outstanding PENDING request blocks a second one;
 * - a trial is granted at most once per account (an APPROVED row), so users
 *   whose trial already ran out can't request another one;
 * - a DECLINED request may be re-submitted (the admin can still approve it).
 */
export function getTrialRequestState(
  user: TrialRequestStateUser,
  requests: TrialRequestLike[]
): TrialRequestState {
  const isPro = isProUser(user)
  const onTrial = isPro && user.isTrial
  const latest = requests[0] ?? null
  const hasUsedTrial = requests.some((r) => r.status === "APPROVED")
  const hasPending = requests.some((r) => r.status === "PENDING")

  return {
    status: latest?.status ?? null,
    requestedAt: toIso(latest?.createdAt),
    decidedAt: toIso(latest?.decidedAt),
    message: latest?.message ?? null,
    onTrial,
    trialEndsAt: onTrial ? toIso(user.currentPeriodEnd) : null,
    hasUsedTrial,
    isPro,
    canRequest: !isPro && !hasUsedTrial && !hasPending,
  }
}

/**
 * Why a request was refused — surfaced to the user as a 409 message.
 * Kept next to the eligibility rules so the two can't drift.
 */
export function trialRequestBlockReason(state: TrialRequestState): string | null {
  if (state.isPro) return "Your account is already on the Pro plan"
  if (state.status === "PENDING") {
    return "You already have a trial request awaiting review"
  }
  if (state.hasUsedTrial) {
    return "Your Pro trial has already been used"
  }
  return null
}

/**
 * Email every active administrator about a new trial request.
 *
 * Best-effort: failures are logged inside `sendEmail` and never bubble up, so a
 * mail outage can't break the request itself. Returns how many admins were
 * notified.
 */
export async function notifyAdminsOfTrialRequest(request: {
  userName: string | null
  userEmail: string
  message: string | null
}): Promise<number> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", suspended: false },
    select: { email: true },
  })

  if (admins.length === 0) return 0

  const who = request.userName ? `${request.userName} (${request.userEmail})` : request.userEmail
  const html = `
    <h2 style="color:#111">New Pro trial request</h2>
    <p><strong>${who}</strong> has requested a free Pro trial.</p>
    ${
      request.message
        ? `<blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px;color:#444">${request.message}</blockquote>`
        : ""
    }
    <p>Review it from the Admin panel, where you can approve (30 days of Pro) or
    decline the request.</p>
  `

  await Promise.all(
    admins.map((admin) =>
      sendEmail({
        to: admin.email,
        subject: `Trial request from ${who}`,
        html,
      })
    )
  )

  return admins.length
}

/** Email the user that their trial is now active, with the end date. */
export async function notifyUserOfApprovedTrial(request: {
  userEmail: string
  trialEndsAt: Date
}): Promise<void> {
  const endsOn = formatDate(request.trialEndsAt)

  await sendEmail({
    to: request.userEmail,
    subject: "Your Pro trial is active",
    html: `
      <h2 style="color:#111">Your Pro trial is active</h2>
      <p>An administrator approved your request. You have full access to every
      Pro module until <strong>${endsOn}</strong>, after which your account
      returns to the Free plan automatically.</p>
    `,
  })
}
