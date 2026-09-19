import { describe, it, expect } from "vitest"
import {
  isAdminUser,
  isProUser,
  isProOnlyPath,
  planLabel,
  subscriptionStatusLabel,
  proTrialPeriodEnd,
  PRO_PRICE_IDR,
  PRO_TRIAL_DAYS,
} from "../subscription"

const freeUser = {
  role: "USER" as const,
  plan: "FREE" as const,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  suspended: false,
}

const proUser = {
  role: "USER" as const,
  plan: "PRO" as const,
  subscriptionStatus: "ACTIVE" as const,
  currentPeriodEnd: null,
  suspended: false,
}

describe("isProUser", () => {
  it("denies free users", () => {
    expect(isProUser(freeUser)).toBe(false)
  })

  it("allows an active Pro subscription without an end date", () => {
    expect(isProUser(proUser)).toBe(true)
  })

  it("allows Pro while the current period has not ended", () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    expect(isProUser({ ...proUser, currentPeriodEnd: future })).toBe(true)
  })

  it("denies Pro once the current period has ended", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000)
    expect(isProUser({ ...proUser, currentPeriodEnd: past })).toBe(false)
  })

  it("accepts ISO date strings for the period end", () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(isProUser({ ...proUser, currentPeriodEnd: future })).toBe(true)
  })

  it("denies non-ACTIVE subscription statuses", () => {
    for (const status of ["PAST_DUE", "CANCELED", "EXPIRED"] as const) {
      expect(isProUser({ ...proUser, subscriptionStatus: status })).toBe(false)
    }
  })

  it("denies suspended users even with an active Pro plan", () => {
    expect(isProUser({ ...proUser, suspended: true })).toBe(false)
  })

  it("grants admins access regardless of plan", () => {
    expect(isProUser({ ...freeUser, role: "ADMIN" })).toBe(true)
    expect(isProUser({ ...freeUser, role: "ADMIN", suspended: true })).toBe(false)
  })
})

describe("isAdminUser", () => {
  it("only admits non-suspended ADMIN roles", () => {
    expect(isAdminUser({ role: "ADMIN", suspended: false })).toBe(true)
    expect(isAdminUser({ role: "ADMIN", suspended: true })).toBe(false)
    expect(isAdminUser({ role: "USER", suspended: false })).toBe(false)
  })
})

describe("labels & constants", () => {
  it("labels plans", () => {
    expect(planLabel("FREE")).toBe("Free")
    expect(planLabel("PRO")).toBe("Pro")
  })

  it("labels subscription statuses", () => {
    expect(subscriptionStatusLabel("ACTIVE")).toBe("Active")
    expect(subscriptionStatusLabel("PAST_DUE")).toBe("Past due")
    expect(subscriptionStatusLabel("CANCELED")).toBe("Canceled")
    expect(subscriptionStatusLabel("EXPIRED")).toBe("Expired")
    expect(subscriptionStatusLabel(null)).toBe("—")
  })

  it("has a positive IDR price constant", () => {
    expect(PRO_PRICE_IDR).toBeGreaterThan(0)
  })

  it("grants a 30-day trial", () => {
    expect(PRO_TRIAL_DAYS).toBe(30)
  })
})

describe("proTrialPeriodEnd", () => {
  it("runs for PRO_TRIAL_DAYS from the given start", () => {
    const start = new Date("2026-09-20T10:00:00.000Z")
    expect(proTrialPeriodEnd(start).toISOString()).toBe(
      "2026-10-20T10:00:00.000Z"
    )
  })

  it("defaults to now", () => {
    const before = Date.now()
    const end = proTrialPeriodEnd().getTime()
    const expected = before + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000
    expect(end).toBeGreaterThanOrEqual(expected)
    expect(end).toBeLessThanOrEqual(Date.now() + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000)
  })

  it("crosses a year boundary correctly", () => {
    expect(proTrialPeriodEnd(new Date("2026-12-15T00:00:00.000Z")).toISOString()).toBe(
      "2027-01-14T00:00:00.000Z"
    )
  })
})

describe("isProOnlyPath", () => {
  it("matches paid module paths (and their subpaths)", () => {
    expect(isProOnlyPath("/gold")).toBe(true)
    expect(isProOnlyPath("/gold/some-id")).toBe(true)
    expect(isProOnlyPath("/stocks")).toBe(true)
    expect(isProOnlyPath("/budgets")).toBe(true)
    expect(isProOnlyPath("/reports")).toBe(true)
    expect(isProOnlyPath("/analysis")).toBe(true)
  })

  it("does not match free modules or lookalikes", () => {
    expect(isProOnlyPath("/dashboard")).toBe(false)
    expect(isProOnlyPath("/transactions")).toBe(false)
    expect(isProOnlyPath("/settings")).toBe(false)
    expect(isProOnlyPath("/goldfish")).toBe(false)
    expect(isProOnlyPath("/")).toBe(false)
  })
})
