import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock YahooFinance before importing the module under test.
const { mockQuoteSummary, mockChart } = vi.hoisted(() => ({
  mockQuoteSummary: vi.fn(),
  mockChart: vi.fn(),
}))

vi.mock("yahoo-finance2", () => ({
  default: vi.fn(function () {
    return { quoteSummary: mockQuoteSummary, chart: mockChart }
  }),
}))

import {
  getYahooSymbol,
  parseDividendEvents,
  classifyFrequency,
  estimateNextExDate,
  sumTrailingDividend,
  countTrailingDividends,
  buildDividendCalendar,
  buildDividendInfo,
  fetchStockDividendInfo,
  fetchStockDividendInfos,
  clearDividendCache,
  ESTIMATED_PAYMENT_LAG_DAYS,
  type DividendPayment,
  type CalendarProjectionInput,
} from "../dividends"

/** ISO date `days` in the past — keeps window-sensitive tests time-independent. */
const isoDaysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const DAY = 24 * 60 * 60 * 1000

/** Build a Yahoo-shaped chart payload (dividends keyed by timestamp). */
function makeChart(payments: { date: string; amount: number }[]) {
  const dividends: Record<string, { amount: number; date: Date }> = {}
  for (const p of payments) {
    dividends[String(new Date(`${p.date}T00:00:00Z`).getTime())] = {
      amount: p.amount,
      date: new Date(`${p.date}T00:00:00Z`),
    }
  }
  return { events: { dividends } }
}

function payments(...items: [string, number][]): DividendPayment[] {
  return items.map(([date, amountPerShare]) => ({ date, amountPerShare }))
}

beforeEach(() => {
  vi.clearAllMocks()
  clearDividendCache()
})

// ─── getYahooSymbol ──────────────────────────────

describe("getYahooSymbol", () => {
  it("appends .JK to a clean IDX symbol", () => {
    expect(getYahooSymbol("ANTM")).toBe("ANTM.JK")
  })

  it("leaves an already-suffixed symbol alone", () => {
    expect(getYahooSymbol("ANTM.JK")).toBe("ANTM.JK")
  })

  it("normalises case and whitespace", () => {
    expect(getYahooSymbol("  bbca  ")).toBe("BBCA.JK")
  })

  it("keeps non-IDX suffixes (e.g. US tickers)", () => {
    expect(getYahooSymbol("AAPL")).toBe("AAPL.JK")
    expect(getYahooSymbol("BRK.B")).toBe("BRK.B")
  })
})

// ─── parseDividendEvents ─────────────────────────

describe("parseDividendEvents", () => {
  it("returns payments newest first", () => {
    const chart = makeChart([
      { date: "2025-06-23", amount: 151.77 },
      { date: "2026-06-22", amount: 209.99 },
    ])

    const result = parseDividendEvents(chart)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: "2026-06-22", amountPerShare: 209.99 })
    expect(result[1].date).toBe("2025-06-23")
  })

  it("ignores zero, negative and unparseable amounts", () => {
    const chart = {
      events: {
        dividends: {
          a: { amount: 100, date: new Date("2026-01-01") },
          b: { amount: 0, date: new Date("2026-02-01") },
          c: { amount: -5, date: new Date("2026-03-01") },
          d: { amount: 50 },
        },
      },
    }

    expect(parseDividendEvents(chart)).toEqual([
      { date: "2026-01-01", amountPerShare: 100 },
    ])
  })

  it("returns an empty list when Yahoo omits dividend events", () => {
    expect(parseDividendEvents(null)).toEqual([])
    expect(parseDividendEvents({})).toEqual([])
    expect(parseDividendEvents({ events: {} })).toEqual([])
  })
})

// ─── classifyFrequency ───────────────────────────

describe("classifyFrequency", () => {
  it("needs at least two payments to infer a cadence", () => {
    expect(classifyFrequency(payments(["2026-06-22", 210]))).toEqual({
      frequency: "UNKNOWN",
      medianGapDays: null,
    })
    expect(classifyFrequency([])).toEqual({ frequency: "UNKNOWN", medianGapDays: null })
  })

  it("detects an annual payer", () => {
    const result = classifyFrequency(
      payments(["2026-06-22", 210], ["2025-06-23", 152])
    )
    expect(result.frequency).toBe("ANNUAL")
    expect(result.medianGapDays).toBe(364)
  })

  it("detects a quarterly payer", () => {
    const result = classifyFrequency(
      payments(
        ["2026-08-31", 25],
        ["2026-06-17", 20],
        ["2026-03-30", 281],
        ["2025-12-03", 55]
      )
    )
    expect(result.frequency).toBe("QUARTERLY")
    expect(result.medianGapDays).toBe(79)
  })

  it("detects a twice-a-year payer", () => {
    const result = classifyFrequency(
      payments(["2026-05-05", 292], ["2025-10-14", 98])
    )
    expect(result.frequency).toBe("SEMIANNUAL")
    expect(result.medianGapDays).toBe(203)
  })

  it("falls back to IRREGULAR when no cadence fits", () => {
    const result = classifyFrequency(
      payments(["2026-08-01", 10], ["2024-01-01", 10])
    )
    expect(result.frequency).toBe("IRREGULAR")
  })

  it("weights recent gaps so changed payout rhythms aren't averaged away", () => {
    // Two years of quarterly-ish history whose older gaps are much wider.
    // The two-year median is 117d; only the recent ~77d matches today's rhythm.
    const result = classifyFrequency(
      payments(
        ["2026-08-31", 25],
        ["2026-06-17", 20],
        ["2026-03-30", 281],
        ["2025-12-03", 55],
        ["2025-03-21", 250],
        ["2024-11-21", 50]
      )
    )

    expect(result.medianGapDays).toBe(79)
    expect(result.frequency).toBe("QUARTERLY")
  })
})

// ─── estimateNextExDate ──────────────────────────

describe("estimateNextExDate", () => {
  const now = new Date("2026-09-20T00:00:00Z")

  it("projects from the last payment plus the typical gap", () => {
    // Last paid 2026-06-22, annual payer => ~2027-06-21.
    expect(estimateNextExDate("2026-06-22", 364, now)).toBe("2027-06-21")
  })

  it("rolls forward when the naive projection lands in the past", () => {
    const iso = (days: number) =>
      new Date(now.getTime() - days * DAY).toISOString().slice(0, 10)

    // Paid 45 days ago on a 30-day cadence: the next date is already due.
    const result = estimateNextExDate(iso(45), 30, now)

    expect(result).not.toBeNull()
    expect(new Date(`${result}T00:00:00Z`).getTime()).toBeGreaterThan(now.getTime())
  })

  it("returns null without a usable cadence or date", () => {
    expect(estimateNextExDate("2026-06-22", null, now)).toBeNull()
    expect(estimateNextExDate(null, 90, now)).toBeNull()
    expect(estimateNextExDate("2026-06-22", 0, now)).toBeNull()
  })

  it("returns null for a stale payer rather than inventing a future date", () => {
    // Last paid over two intervals ago — the pattern is no longer reliable.
    expect(estimateNextExDate("2025-01-01", 90, now)).toBeNull()
  })
})

// ─── sumTrailingDividend ─────────────────────────

describe("sumTrailingDividend", () => {
  const now = new Date("2026-09-20T00:00:00Z")

  it("sums only the payments inside the trailing window", () => {
    const result = sumTrailingDividend(
      payments(
        ["2026-08-31", 25],
        ["2026-06-17", 20],
        ["2026-03-30", 281],
        ["2024-11-21", 50]
      ),
      12,
      now
    )

    expect(result).toBe(326)
  })

  it("returns null when nothing was paid in the window", () => {
    expect(sumTrailingDividend(payments(["2020-01-01", 100]), 12, now)).toBeNull()
    expect(sumTrailingDividend([], 12, now)).toBeNull()
  })
})

// ─── countTrailingDividends ──────────────────────

describe("countTrailingDividends", () => {
  const now = new Date("2026-09-20T00:00:00Z")

  it("counts only payments inside the trailing window", () => {
    const result = countTrailingDividends(
      payments(
        ["2026-08-31", 25],
        ["2026-06-17", 20],
        ["2026-03-30", 281],
        ["2025-12-03", 55],
        ["2024-11-21", 50]
      ),
      12,
      now
    )

    expect(result).toBe(4)
  })

  it("is zero when nothing was paid recently", () => {
    expect(countTrailingDividends(payments(["2020-01-01", 100]), 12, now)).toBe(0)
    expect(countTrailingDividends([], 12, now)).toBe(0)
  })
})

// ─── buildDividendCalendar ───────────────────────

describe("buildDividendCalendar", () => {
  const now = new Date("2026-09-20T00:00:00Z")

  function projection(overrides: Partial<CalendarProjectionInput> = {}): CalendarProjectionInput {
    return {
      symbol: "BBCA",
      name: "Bank Central Asia Tbk.",
      lots: 10,
      shares: 1000,
      amountPerPayment: 100,
      estimatedNextExDate: "2026-11-18",
      medianGapDays: 79,
      ...overrides,
    }
  }

  it("returns 12 buckets starting from the current month", () => {
    const result = buildDividendCalendar([], now)

    expect(result.months).toHaveLength(12)
    expect(result.months[0].month).toBe("2026-09")
    expect(result.months[11].month).toBe("2027-08")
    expect(result.total).toBe(0)
    expect(result.paymentsCount).toBe(0)
  })

  it("rolls a quarterly payer forward into the right months", () => {
    const result = buildDividendCalendar([projection()], now)

    // ex-dates 18 Nov, 5 Feb, 25 Apr, 13 Jul (+21 days to each payout date),
    // with the following one landing past the end of the window.
    const paid = result.months.filter((m) => m.payments.length > 0).map((m) => m.month)
    expect(paid).toEqual(["2026-12", "2027-02", "2027-05", "2027-08"])
    expect(result.paymentsCount).toBe(4)
    // 1,000 shares x 100 per payment
    expect(result.total).toBe(400_000)
  })

  it("places a payout in the month the cash lands, not the ex-dividend month", () => {
    const result = buildDividendCalendar([projection()], now)
    const december = result.months.find((m) => m.month === "2026-12")!

    const payment = december.payments[0]
    expect(payment).toMatchObject({
      symbol: "BBCA",
      shares: 1000,
      amount: 100_000,
      // The ex-date is in November, but the payment is expected in December.
      estimatedExDate: "2026-11-18",
      estimatedPayDate: "2026-12-09",
    })
    expect(
      (new Date(`${payment.estimatedPayDate}T00:00:00Z`).getTime() -
        new Date(`${payment.estimatedExDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ).toBe(ESTIMATED_PAYMENT_LAG_DAYS)
    const november = result.months.find((m) => m.month === "2026-11")!
    expect(november.payments).toHaveLength(0)
  })

  it("merges several holdings landing in the same month", () => {
    const result = buildDividendCalendar(
      [projection(), projection({ symbol: "ANTM", amountPerPayment: 50, shares: 500 })],
      now
    )
    const december = result.months.find((m) => m.month === "2026-12")!

    expect(december.payments).toHaveLength(2)
    // 100,000 + (500 x 50)
    expect(december.total).toBe(125_000)
  })

  it("skips holdings that cannot be projected", () => {
    const result = buildDividendCalendar(
      [
        projection({ estimatedNextExDate: null }),
        projection({ amountPerPayment: null }),
        projection({ medianGapDays: null }),
        projection({ medianGapDays: 0 }),
      ],
      now
    )

    expect(result.paymentsCount).toBe(0)
    expect(result.total).toBe(0)
  })

  it("caps runaway projections from a tiny inferred gap", () => {
    const result = buildDividendCalendar([projection({ medianGapDays: 1 })], now)

    expect(result.paymentsCount).toBe(24)
  })

  it("ignores payouts that fall beyond the window", () => {
    // Ex-date is inside the window but the payout date is past its end.
    const result = buildDividendCalendar(
      [projection({ estimatedNextExDate: "2027-08-25", medianGapDays: 365 })],
      now
    )

    // 25 Aug 2027 + 21 days = 15 Sep 2027, past the 31 Aug 2027 window end.
    expect(result.paymentsCount).toBe(0)
  })
})

// ─── buildDividendInfo ───────────────────────────

describe("buildDividendInfo", () => {
  it("returns null when Yahoo supplies nothing", () => {
    expect(buildDividendInfo("ANTM", null, null)).toBeNull()
  })

  it("returns null for a stock with no dividend amounts at all", () => {
    expect(buildDividendInfo("ANTM", { summaryDetail: {} }, {})).toBeNull()
  })

  it("prefers the newest chart payment over the key-stats snapshot", () => {
    const info = buildDividendInfo(
      "ANTM",
      {
        price: { currency: "IDR" },
        summaryDetail: { dividendYield: 0.0629, trailingAnnualDividendRate: 209.99 },
        defaultKeyStatistics: { lastDividendValue: 999, lastDividendDate: "2000-01-01" },
      },
      makeChart([
        { date: "2025-06-23", amount: 151.77 },
        { date: "2026-06-22", amount: 209.99 },
      ])
    )

    expect(info).not.toBeNull()
    expect(info!.lastDividendPerShare).toBe(209.99)
    expect(info!.lastDividendDate).toBe("2026-06-22")
    expect(info!.currency).toBe("IDR")
    expect(info!.dividendYield).toBe(0.0629)
    expect(info!.frequency).toBe("ANNUAL")
  })

  it("falls back to key stats when there is no payment history", () => {
    const info = buildDividendInfo(
      "BBCA",
      {
        price: { currency: "IDR" },
        summaryDetail: { trailingAnnualDividendRate: 381 },
        defaultKeyStatistics: { lastDividendValue: 25, lastDividendDate: "2026-08-31" },
      },
      { events: { dividends: {} } }
    )

    expect(info!.lastDividendPerShare).toBe(25)
    expect(info!.lastDividendDate).toBe("2026-08-31")
    expect(info!.trailingDividendPerShare).toBe(381)
    // A single known payment is not enough to project a next date.
    expect(info!.frequency).toBe("UNKNOWN")
    expect(info!.estimatedNextExDate).toBeNull()
  })

  it("defaults the currency to IDR when Yahoo omits it", () => {
    const info = buildDividendInfo("ANTM", { summaryDetail: {} }, makeChart([
      { date: "2026-06-22", amount: 210 },
    ]))

    expect(info!.currency).toBe("IDR")
  })
})

// ─── fetchStockDividendInfo(s) ───────────────────

describe("fetchStockDividendInfo", () => {
  it("queries Yahoo with the .JK symbol and derives the projection", async () => {
    mockQuoteSummary.mockResolvedValue({
      price: { currency: "IDR" },
      summaryDetail: { dividendYield: 0.0629 },
    })
    // Dates are relative to now: one inside the trailing 12-month window, one
    // well outside it, so this doesn't rot as the calendar moves on.
    mockChart.mockResolvedValue(
      makeChart([
        { date: isoDaysAgo(455), amount: 151.77 },
        { date: isoDaysAgo(90), amount: 209.99 },
      ])
    )

    const info = await fetchStockDividendInfo("ANTM")

    expect(mockQuoteSummary).toHaveBeenCalledWith(
      "ANTM.JK",
      expect.objectContaining({ modules: expect.any(Array) })
    )
    expect(info!.symbol).toBe("ANTM")
    expect(info!.lastDividendPerShare).toBe(209.99)
    expect(info!.trailingDividendPerShare).toBe(209.99)
    expect(info!.trailingPaymentCount).toBe(1)
    expect(info!.frequency).toBe("ANNUAL")
  })

  it("returns null when Yahoo has no data for the symbol", async () => {
    mockQuoteSummary.mockRejectedValue(new Error("Not found"))
    mockChart.mockRejectedValue(new Error("Not found"))

    expect(await fetchStockDividendInfo("ZZZZ")).toBeNull()
  })

  it("still works when only the chart call fails", async () => {
    mockQuoteSummary.mockResolvedValue({
      summaryDetail: { trailingAnnualDividendRate: 381 },
      defaultKeyStatistics: { lastDividendValue: 25 },
    })
    mockChart.mockRejectedValue(new Error("chart unavailable"))

    const info = await fetchStockDividendInfo("BBCA")

    expect(info!.lastDividendPerShare).toBe(25)
  })

  it("caches results so repeated refreshes don't re-hit Yahoo", async () => {
    mockQuoteSummary.mockResolvedValue({ summaryDetail: { trailingAnnualDividendRate: 381 } })
    mockChart.mockResolvedValue(makeChart([{ date: "2026-08-31", amount: 25 }]))

    await fetchStockDividendInfo("BBCA")
    await fetchStockDividendInfo("BBCA")

    expect(mockChart).toHaveBeenCalledTimes(1)
  })
})

describe("fetchStockDividendInfos", () => {
  it("omits symbols Yahoo has no dividend data for", async () => {
    mockQuoteSummary.mockImplementation(async (symbol: string) => {
      if (symbol === "ZZZZ.JK") throw new Error("Not found")
      return { price: { currency: "IDR" }, summaryDetail: { trailingAnnualDividendRate: 100 } }
    })
    mockChart.mockImplementation(async (symbol: string) => {
      if (symbol === "ZZZZ.JK") throw new Error("Not found")
      return makeChart([{ date: "2026-06-22", amount: 100 }])
    })

    const result = await fetchStockDividendInfos(["ANTM", "ZZZZ", "ANTM"])

    expect([...result.keys()]).toEqual(["ANTM"])
    expect(result.get("ANTM")!.symbol).toBe("ANTM")
  })

  it("returns an empty map for no symbols", async () => {
    const result = await fetchStockDividendInfos([])

    expect(result.size).toBe(0)
    expect(mockChart).not.toHaveBeenCalled()
  })

  it("does not throw when one symbol blows up unexpectedly", async () => {
    mockQuoteSummary.mockImplementation(async (symbol: string) => {
      if (symbol === "BOOM.JK") throw new Error("unexpected")
      return { summaryDetail: { trailingAnnualDividendRate: 100 } }
    })
    mockChart.mockImplementation(async (symbol: string) => {
      if (symbol === "BOOM.JK") throw new Error("unexpected")
      return makeChart([{ date: "2026-06-22", amount: 100 }])
    })

    const result = await fetchStockDividendInfos(["ANTM", "BOOM"])

    expect([...result.keys()]).toEqual(["ANTM"])
  })
})
