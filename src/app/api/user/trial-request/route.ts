import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit"
import { trialRequestSchema, safeParseBody } from "@/lib/validation"
import {
  getTrialRequestState,
  notifyAdminsOfTrialRequest,
  trialRequestBlockReason,
  type TrialRequestLike,
} from "@/lib/trial-request"

/**
 * Fields needed both to decide trial eligibility (see `getTrialRequestState`)
 * and to email the administrators about a new request.
 */
const USER_SELECT = {
  name: true,
  email: true,
  role: true,
  plan: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
  isTrial: true,
  suspended: true,
} as const

const REQUEST_SELECT = {
  status: true,
  message: true,
  createdAt: true,
  decidedAt: true,
} as const

/** Load the user's request history (newest first) and derive their state. */
async function loadTrialState(userId: string) {
  const [user, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT }),
    prisma.trialRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: REQUEST_SELECT,
    }),
  ])

  if (!user) return null

  return {
    user,
    state: getTrialRequestState(user, requests as TrialRequestLike[]),
  }
}

/**
 * GET /api/user/trial-request
 *
 * The signed-in user's trial state: whether they may request one, whether a
 * request is pending review, and when a running trial ends. Drives the
 * Settings → Pro trial card.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const loaded = await loadTrialState(session.user.id)
    if (!loaded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(loaded.state)
  } catch (error) {
    console.error("Fetch trial request error:", error)
    return NextResponse.json(
      { error: "Failed to load trial request" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/trial-request
 * Body: { message? }
 *
 * Records a request for a free Pro trial and notifies the administrators, who
 * approve (granting 30 days of Pro) or decline it from the admin panel.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 3 requests per hour per IP — each one emails every admin.
  const limiter = await rateLimit(`trial-request:${getRateLimitKey(req)}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  })
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((limiter.resetTime - Date.now()) / 1000)) },
      }
    )
  }

  const parsed = await safeParseBody(req, trialRequestSchema)
  if ("error" in parsed) return parsed.error

  const message = parsed.data.message?.trim() || null

  try {
    const loaded = await loadTrialState(session.user.id)
    if (!loaded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // One request at a time, and only one trial per account.
    const blockReason = trialRequestBlockReason(loaded.state)
    if (blockReason) {
      return NextResponse.json({ error: blockReason }, { status: 409 })
    }

    await prisma.trialRequest.create({
      data: { userId: session.user.id, message },
    })

    // Notify the admins — best-effort: a mail outage must not fail the request.
    try {
      await notifyAdminsOfTrialRequest({
        userName: loaded.user.name,
        userEmail: loaded.user.email,
        message,
      })
    } catch (error) {
      console.error("Trial request notification error:", error)
    }

    const refreshed = await loadTrialState(session.user.id)

    return NextResponse.json(refreshed?.state ?? loaded.state, { status: 201 })
  } catch (error) {
    console.error("Create trial request error:", error)
    return NextResponse.json(
      { error: "Failed to submit trial request" },
      { status: 500 }
    )
  }
}
