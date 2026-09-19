import { describe, it, expect } from "vitest"
import {
  getTrialRequestState,
  trialRequestBlockReason,
  type TrialRequestLike,
  type TrialRequestStateUser,
} from "../trial-request"

/** A free, entitled-to-nothing user. */
function user(overrides: Partial<TrialRequestStateUser> = {}): TrialRequestStateUser {
  return {
    role: "USER",
    plan: "FREE",
    subscriptionStatus: null,
    currentPeriodEnd: null,
    isTrial: false,
    suspended: false,
    ...overrides,
  }
}

const request = (
  status: TrialRequestLike["status"],
  extra: Partial<TrialRequestLike> = {}
): TrialRequestLike => ({
  status,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  decidedAt: null,
  message: null,
  ...extra,
})

describe("getTrialRequestState", () => {
  it("lets a fresh Free user request a trial", () => {
    const state = getTrialRequestState(user(), [])

    expect(state).toMatchObject({
      status: null,
      canRequest: true,
      hasUsedTrial: false,
      onTrial: false,
      isPro: false,
    })
  })

  it("blocks a second request while one is pending", () => {
    const state = getTrialRequestState(user(), [request("PENDING")])

    expect(state.status).toBe("PENDING")
    expect(state.canRequest).toBe(false)
    expect(trialRequestBlockReason(state)).toBe(
      "You already have a trial request awaiting review"
    )
  })

  it("allows re-requesting after a decline", () => {
    const state = getTrialRequestState(user(), [request("DECLINED")])

    expect(state.status).toBe("DECLINED")
    expect(state.canRequest).toBe(true)
    expect(trialRequestBlockReason(state)).toBeNull()
  })

  it("never allows a second trial once one was approved", () => {
    const state = getTrialRequestState(user(), [request("APPROVED")])

    expect(state.hasUsedTrial).toBe(true)
    expect(state.canRequest).toBe(false)
    expect(trialRequestBlockReason(state)).toBe(
      "Your Pro trial has already been used"
    )
  })

  it("reports a running trial and when it ends", () => {
    const ends = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    const state = getTrialRequestState(
      user({
        plan: "PRO",
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: ends,
        isTrial: true,
      }),
      [request("APPROVED")]
    )

    expect(state.onTrial).toBe(true)
    expect(state.isPro).toBe(true)
    expect(state.trialEndsAt).toBe(ends.toISOString())
    expect(state.canRequest).toBe(false)
    expect(trialRequestBlockReason(state)).toBe(
      "Your account is already on the Pro plan"
    )
  })

  it("treats a lapsed trial as not entitled but still used", () => {
    const state = getTrialRequestState(
      user({
        plan: "PRO",
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() - 60 * 60 * 1000),
        isTrial: true,
      }),
      [request("APPROVED")]
    )

    expect(state.onTrial).toBe(false)
    expect(state.isPro).toBe(false)
    expect(state.trialEndsAt).toBeNull()
    expect(state.hasUsedTrial).toBe(true)
    expect(state.canRequest).toBe(false)
  })

  it("keeps paying Pro users ineligible", () => {
    const state = getTrialRequestState(
      user({ plan: "PRO", subscriptionStatus: "ACTIVE", isTrial: false }),
      []
    )

    expect(state.onTrial).toBe(false)
    expect(state.isPro).toBe(true)
    expect(state.canRequest).toBe(false)
  })

  it("surfaces the newest request's message and dates", () => {
    const state = getTrialRequestState(user(), [
      request("DECLINED", {
        createdAt: new Date("2026-09-10T00:00:00.000Z"),
        decidedAt: new Date("2026-09-11T00:00:00.000Z"),
        message: "latest note",
      }),
      request("PENDING", { message: "older note" }),
    ])

    // Even though an older PENDING row exists, the newest row is the DECLINED
    // one — but a pending request anywhere still blocks a new request.
    expect(state.status).toBe("DECLINED")
    expect(state.message).toBe("latest note")
    expect(state.requestedAt).toBe("2026-09-10T00:00:00.000Z")
    expect(state.decidedAt).toBe("2026-09-11T00:00:00.000Z")
    expect(state.canRequest).toBe(false)
  })

  it("accepts ISO strings as well as Dates", () => {
    const state = getTrialRequestState(user(), [
      {
        status: "PENDING",
        createdAt: "2026-09-05T00:00:00.000Z",
        decidedAt: null,
        message: null,
      },
    ])

    expect(state.requestedAt).toBe("2026-09-05T00:00:00.000Z")
  })

  it("gives admins Pro access without a trial", () => {
    const state = getTrialRequestState(
      user({ role: "ADMIN", plan: "FREE" }),
      []
    )

    expect(state.isPro).toBe(true)
    expect(state.onTrial).toBe(false)
    expect(state.canRequest).toBe(false)
  })
})
