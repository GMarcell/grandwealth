import { describe, it, expect, vi } from "vitest"
import {
  selectDueBills,
  selectBudgetAlerts,
  alertEmailSubject,
  renderAlertEmail,
  type BillAlert,
  type BudgetAlert,
} from "@/lib/alerts"
import type { CarryOverEntry } from "@/lib/budget-carry-over"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

const NOW = new Date(2026, 10, 10, 9, 0, 0) // 10 Nov 2026, 09:00 local

const bill = (overrides: Partial<{
  id: string
  description: string
  category: string
  amount: number
  nextDate: Date
  endDate: Date | null
}> = {}) => ({
  id: "rec_1",
  description: "Rent",
  category: "HOUSING",
  amount: 5_000_000,
  nextDate: new Date(2026, 10, 12, 0, 0, 0),
  endDate: null,
  ...overrides,
})

const entry = (overrides: Partial<CarryOverEntry> = {}): CarryOverEntry => ({
  categoryName: "FOOD",
  month: "2026-11",
  amount: 1_000_000,
  spent: 0,
  rollover: 0,
  effectiveAmount: 1_000_000,
  unused: 1_000_000,
  ...overrides,
})

describe("selectDueBills", () => {
  it("includes bills inside the reminder window and excludes later ones", () => {
    const result = selectDueBills(
      [
        bill({ id: "soon" }),
        bill({
          id: "later",
          nextDate: new Date(2026, 10, 20, 0, 0, 0),
        }),
      ],
      NOW,
      3,
    )

    expect(result.map((b) => b.recurringId)).toEqual(["soon"])
    expect(result[0].key).toBe("bill:soon:2026-11-12")
  })

  it("includes overdue occurrences so a failed cron is still surfaced", () => {
    const result = selectDueBills(
      [bill({ nextDate: new Date(2026, 10, 8, 0, 0, 0) })],
      NOW,
      3,
    )

    expect(result).toHaveLength(1)
  })

  it("sorts by due date", () => {
    const result = selectDueBills(
      [
        bill({ id: "b", nextDate: new Date(2026, 10, 13, 0, 0, 0) }),
        bill({ id: "a", nextDate: new Date(2026, 10, 11, 0, 0, 0) }),
      ],
      NOW,
      3,
    )

    expect(result.map((b) => b.recurringId)).toEqual(["a", "b"])
  })

  it("skips schedules whose next occurrence is past their end date", () => {
    const result = selectDueBills(
      [
        bill({
          nextDate: new Date(2026, 10, 12, 0, 0, 0),
          endDate: new Date(2026, 10, 9, 0, 0, 0),
        }),
      ],
      NOW,
      3,
    )

    expect(result).toHaveLength(0)
  })

  it("clamps the reminder window to 1–14 days", () => {
    const far = bill({ nextDate: new Date(2026, 10, 24, 0, 0, 0) })

    // 0 is clamped up to 1 day — the far bill stays out.
    expect(selectDueBills([far], NOW, 0)).toHaveLength(0)
    // 100 is clamped down to 14 days — the bill 14 days out is included.
    expect(selectDueBills([far], NOW, 100)).toHaveLength(1)
  })
})

describe("selectBudgetAlerts", () => {
  it("flags categories at or above the threshold as near limit", () => {
    const alerts = selectBudgetAlerts(
      [entry({ spent: 850_000, effectiveAmount: 1_000_000 })],
      80,
    )

    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe("near")
    expect(alerts[0].percent).toBeCloseTo(85)
    expect(alerts[0].key).toBe("budget:2026-11:FOOD:near")
  })

  it("does not flag spending below the threshold", () => {
    expect(
      selectBudgetAlerts(
        [entry({ spent: 500_000, effectiveAmount: 1_000_000 })],
        80,
      ),
    ).toHaveLength(0)
  })

  it("reports over-budget categories as over, not near", () => {
    const alerts = selectBudgetAlerts(
      [entry({ spent: 1_200_000, effectiveAmount: 1_000_000 })],
      80,
    )

    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe("over")
    expect(alerts[0].key).toBe("budget:2026-11:FOOD:over")
  })

  it("always includes over-budget categories, even at a 100% threshold", () => {
    const alerts = selectBudgetAlerts(
      [entry({ spent: 1_000_000, effectiveAmount: 1_000_000 })],
      100,
    )

    expect(alerts.map((a) => a.level)).toEqual(["over"])
  })

  it("ignores budgets with no effective amount", () => {
    expect(
      selectBudgetAlerts(
        [entry({ effectiveAmount: 0, amount: 0, spent: 5_000 })],
        80,
      ),
    ).toHaveLength(0)
  })

  it("sorts the most-used category first", () => {
    const alerts = selectBudgetAlerts(
      [
        entry({ categoryName: "FOOD", spent: 850_000 }),
        entry({ categoryName: "SHOPPING", spent: 1_500_000 }),
      ],
      80,
    )

    expect(alerts.map((a) => a.categoryName)).toEqual(["SHOPPING", "FOOD"])
  })
})

describe("alert email", () => {
  const bills: BillAlert[] = [
    {
      recurringId: "rec_1",
      description: "Rent",
      category: "HOUSING",
      amount: 5_000_000,
      dueDate: new Date(2026, 10, 12, 0, 0, 0),
      key: "bill:rec_1:2026-11-12",
    },
  ]
  const budgets: BudgetAlert[] = [
    {
      categoryName: "FOOD",
      month: "2026-11",
      spent: 850_000,
      effectiveAmount: 1_000_000,
      percent: 85,
      level: "near",
      key: "budget:2026-11:FOOD:near",
    },
  ]

  it("summarises both alert types in the subject", () => {
    expect(alertEmailSubject({ bills, budgets })).toBe(
      "GrandWealth: 1 bill due, FOOD near limit",
    )
    expect(alertEmailSubject({ bills: [], budgets })).toBe(
      "GrandWealth: FOOD near limit",
    )
    expect(alertEmailSubject({ bills, budgets: [] })).toBe(
      "GrandWealth: 1 bill due",
    )
  })

  it("renders amounts, due labels, and the opt-out note", () => {
    const { html } = renderAlertEmail({
      userName: "Ada",
      monthLabel: "Nov 2026",
      bills,
      budgets,
      siteUrl: "https://grandwealth.test",
      now: NOW,
    })

    expect(html).toContain("5.000.000")
    expect(html).toContain("in 2 days")
    expect(html).toContain("85% used")
    expect(html).toContain("Nov 2026")
    expect(html).toContain("https://grandwealth.test/dashboard")
    expect(html).toContain("Settings")
  })

  it("escapes user-supplied text", () => {
    const { html } = renderAlertEmail({
      userName: "<script>alert(1)</script>",
      monthLabel: "Nov 2026",
      bills: [{ ...bills[0], description: "<b>Rent</b>" }],
      budgets: [{ ...budgets[0], categoryName: "FOOD & DRINK" }],
      siteUrl: "https://grandwealth.test",
      now: NOW,
    })

    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).not.toContain("<b>Rent</b>")
    expect(html).toContain("&lt;b&gt;Rent&lt;/b&gt;")
    expect(html).toContain("FOOD &amp; DRINK")
  })
})
