import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance()

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * How much history we pull to infer a payer's cadence. Two years is enough to
 * see annual, semi-annual and quarterly patterns without over-fetching.
 */
const HISTORY_DAYS = 730

/** Dividend schedules change at most a few times a year, so cache per process. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, { expiresAt: number; value: StockDividendInfo | null }>()

/** Max simultaneous Yahoo requests — keeps a large portfolio from being throttled. */
const FETCH_CONCURRENCY = 4

/**
 * Only the most recent gaps inform the cadence. Payers change rhythm (a special
 * dividend, a skipped interim), and averaging those into the whole history
 * skews the projection: BBCA's recent gaps are ~75-79 days but its two-year
 * median is 117, which pushed the estimated date a month late.
 */
const RECENT_GAP_COUNT = 3

export type DividendFrequency =
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "IRREGULAR"
  | "UNKNOWN"

export interface DividendPayment {
  /** Ex-dividend date, as reported by Yahoo Finance (YYYY-MM-DD). */
  date: string
  amountPerShare: number
}

export interface StockDividendInfo {
  symbol: string
  currency: string
  /** Most recent cash dividend per share. */
  lastDividendPerShare: number | null
  lastDividendDate: string | null
  /** Actual sum of dividends per share paid over the trailing 12 months. */
  trailingDividendPerShare: number | null
  /** How many separate dividends were paid in that same trailing window. */
  trailingPaymentCount: number
  /** Dividend yield as a fraction (0.0629 === 6.29%). */
  dividendYield: number | null
  payoutRatio: number | null
  frequency: DividendFrequency
  /** Typical number of days between ex-dividend dates. */
  medianGapDays: number | null
  /** Projected next ex-dividend date (YYYY-MM-DD), or null when unpredictable. */
  estimatedNextExDate: string | null
  history: DividendPayment[]
}

// ─── Yahoo response shapes (only the fields we read) ──────────────

interface QuoteSummaryData {
  price?: { currency?: string }
  summaryDetail?: {
    currency?: string
    dividendRate?: number
    dividendYield?: number
    payoutRatio?: number
    exDividendDate?: string | Date
    trailingAnnualDividendRate?: number
  }
  defaultKeyStatistics?: {
    lastDividendValue?: number
    lastDividendDate?: string | Date
  }
}

interface ChartDividendEvent {
  amount?: number
  date?: string | Date
}

interface ChartData {
  events?: { dividends?: Record<string, ChartDividendEvent> }
}

// ─── Pure helpers (unit-tested without network) ───────────────────

/**
 * IDX stocks live under the `.JK` suffix on Yahoo Finance. Stored symbols are
 * usually clean ("ANTM"), but tolerate an already-suffixed symbol.
 */
export function getYahooSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase()
  return trimmed.includes(".") ? trimmed : `${trimmed}.JK`
}

function toIsoDate(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

/** Normalise Yahoo's dividend event map into a date-sorted payment list. */
export function parseDividendEvents(chart: unknown): DividendPayment[] {
  const events = (chart as ChartData | null)?.events?.dividends
  if (!events) return []

  const payments: DividendPayment[] = []
  for (const raw of Object.values(events)) {
    const date = toIsoDate(raw?.date)
    const amount = typeof raw?.amount === "string" ? Number(raw.amount) : raw?.amount
    if (date && isPositiveNumber(amount)) {
      payments.push({ date, amountPerShare: amount })
    }
  }

  // Newest first: callers show the latest payment and infer cadence in order.
  return payments.sort((a, b) => b.date.localeCompare(a.date))
}

function daysBetween(earlierIso: string, laterIso: string): number {
  const earlier = new Date(`${earlierIso}T00:00:00Z`).getTime()
  const later = new Date(`${laterIso}T00:00:00Z`).getTime()
  return Math.round((later - earlier) / MS_PER_DAY)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Infer how often a stock pays from the gaps between its ex-dividend dates.
 * Needs at least two payments; a single payment tells us nothing about cadence.
 */
export function classifyFrequency(payments: DividendPayment[]): {
  frequency: DividendFrequency
  medianGapDays: number | null
} {
  if (payments.length < 2) return { frequency: "UNKNOWN", medianGapDays: null }

  const ascending = [...payments].sort((a, b) => a.date.localeCompare(b.date))
  const gaps: number[] = []
  for (let i = 1; i < ascending.length; i++) {
    const gap = daysBetween(ascending[i - 1].date, ascending[i].date)
    if (gap > 0) gaps.push(gap)
  }

  const gap = median(gaps.slice(-RECENT_GAP_COUNT))
  if (gap == null) return { frequency: "UNKNOWN", medianGapDays: null }

  const rounded = Math.round(gap)
  if (rounded >= 20 && rounded <= 45) return { frequency: "MONTHLY", medianGapDays: rounded }
  if (rounded >= 46 && rounded <= 135) return { frequency: "QUARTERLY", medianGapDays: rounded }
  if (rounded >= 136 && rounded <= 250) return { frequency: "SEMIANNUAL", medianGapDays: rounded }
  if (rounded >= 251 && rounded <= 430) return { frequency: "ANNUAL", medianGapDays: rounded }
  return { frequency: "IRREGULAR", medianGapDays: rounded }
}

/**
 * Project the next ex-dividend date from the last one plus the payer's typical
 * gap. Returns null when the cadence is unusable or the payer looks stale — we
 * would rather show nothing than invent a date for a stock that stopped paying.
 */
export function estimateNextExDate(
  lastDate: string | null,
  medianGapDays: number | null,
  now: Date = new Date()
): string | null {
  if (!lastDate || medianGapDays == null || medianGapDays <= 0) return null

  const last = new Date(`${lastDate}T00:00:00Z`).getTime()
  if (Number.isNaN(last)) return null

  // If the most recent payment is older than two intervals, the pattern is
  // broken (special dividend, suspended payout) and projecting is misleading.
  if (last < now.getTime() - medianGapDays * 2 * MS_PER_DAY) return null

  let next = last + medianGapDays * MS_PER_DAY
  let guard = 0
  while (next < now.getTime() && guard < 24) {
    next += medianGapDays * MS_PER_DAY
    guard++
  }

  return new Date(next).toISOString().slice(0, 10)
}

/** Payments that fall inside the trailing `months` window, newest first. */
function paymentsInTrailingWindow(
  payments: DividendPayment[],
  months: number,
  now: Date
): DividendPayment[] {
  const cutoff = now.getTime() - months * 30 * MS_PER_DAY
  return payments.filter((p) => new Date(`${p.date}T00:00:00Z`).getTime() >= cutoff)
}

/** Sum of dividends per share paid within the trailing `months` window. */
export function sumTrailingDividend(
  payments: DividendPayment[],
  months = 12,
  now: Date = new Date()
): number | null {
  if (payments.length === 0) return null
  const total = paymentsInTrailingWindow(payments, months, now).reduce(
    (sum, p) => sum + p.amountPerShare,
    0
  )

  return total > 0 ? Number(total.toFixed(2)) : null
}

/**
 * How many dividends were actually paid in the trailing window. Used to average
 * the per-payment size: payers with a large annual dividend plus small interims
 * (common on IDX) pay wildly different amounts each time.
 */
export function countTrailingDividends(
  payments: DividendPayment[],
  months = 12,
  now: Date = new Date()
): number {
  return paymentsInTrailingWindow(payments, months, now).length
}

// ─── Calendar projection ──────────────────────────

/**
 * IDX payers typically settle a few weeks after the ex-dividend date, so the
 * cash lands in the following month often enough that using the ex-date would
 * misplace the payment on a cashflow calendar.
 */
export const ESTIMATED_PAYMENT_LAG_DAYS = 21

/** Safety valve for payers with a suspiciously tiny inferred gap. */
const MAX_OCCURRENCES_PER_HOLDING = 24

export interface CalendarProjectionInput {
  symbol: string
  name: string
  lots: number
  shares: number
  /** Expected size of a single payment, in currency per share. */
  amountPerPayment: number | null
  estimatedNextExDate: string | null
  medianGapDays: number | null
}

export interface DividendCalendarPayment {
  symbol: string
  name: string
  lots: number
  shares: number
  amount: number
  estimatedExDate: string
  estimatedPayDate: string
}

export interface DividendCalendarMonth {
  /** "YYYY-MM" */
  month: string
  total: number
  payments: DividendCalendarPayment[]
}

export interface DividendCalendar {
  /** Always `monthsAhead` entries, starting with the current month. */
  months: DividendCalendarMonth[]
  total: number
  paymentsCount: number
}

function monthKeyOf(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function addDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00Z`).getTime()
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** First day of the month, in UTC, so bucketing is timezone-stable. */
function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * Roll every holding's next ex-date forward along its own cadence and bucket the
 * expected payouts into the next `monthsAhead` months.
 *
 * Holdings whose cadence or amount is unknown are skipped rather than guessed at.
 */
export function buildDividendCalendar(
  projections: CalendarProjectionInput[],
  now: Date = new Date(),
  monthsAhead = 12
): DividendCalendar {
  const start = monthStart(now)
  const buckets: DividendCalendarMonth[] = []
  for (let i = 0; i < monthsAhead; i++) {
    const month = new Date(start.getTime())
    month.setUTCMonth(month.getUTCMonth() + i)
    buckets.push({ month: monthKeyOf(month), total: 0, payments: [] })
  }
  const byMonth = new Map(buckets.map((b) => [b.month, b]))

  // End of the window: the first day of the month after the last bucket.
  const windowEnd = new Date(start.getTime())
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + monthsAhead)

  for (const projection of projections) {
    const { amountPerPayment, estimatedNextExDate, medianGapDays } = projection
    if (!estimatedNextExDate || amountPerPayment == null || !medianGapDays || medianGapDays <= 0) {
      continue
    }

    let exDate = estimatedNextExDate
    for (let i = 0; i < MAX_OCCURRENCES_PER_HOLDING; i++) {
      const exTime = new Date(`${exDate}T00:00:00Z`).getTime()
      if (Number.isNaN(exTime) || exTime >= windowEnd.getTime()) break

      const payDate = addDays(exDate, ESTIMATED_PAYMENT_LAG_DAYS)
      const bucket = byMonth.get(payDate.slice(0, 7))
      if (bucket) {
        const amount = Math.round(amountPerPayment * projection.shares)
        bucket.payments.push({
          symbol: projection.symbol,
          name: projection.name,
          lots: projection.lots,
          shares: projection.shares,
          amount,
          estimatedExDate: exDate,
          estimatedPayDate: payDate,
        })
        bucket.total += amount
      }

      exDate = addDays(exDate, medianGapDays)
    }
  }

  const paymentsCount = buckets.reduce((sum, b) => sum + b.payments.length, 0)

  return {
    months: buckets,
    total: buckets.reduce((sum, b) => sum + b.total, 0),
    paymentsCount,
  }
}

// ─── Fetching ─────────────────────────────────────────────────────

/**
 * Look up a stock's dividend history and schedule on Yahoo Finance.
 * Returns null when Yahoo has no usable data for the symbol.
 */
export async function fetchStockDividendInfo(symbol: string): Promise<StockDividendInfo | null> {
  const yahooSymbol = getYahooSymbol(symbol)

  const cached = cache.get(yahooSymbol)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const period1 = new Date(Date.now() - HISTORY_DAYS * MS_PER_DAY)

  const [summary, chart] = await Promise.all([
    yahooFinance
      .quoteSummary(yahooSymbol, {
        modules: ["price", "summaryDetail", "defaultKeyStatistics"],
      })
      .catch(() => null) as Promise<QuoteSummaryData | null>,
    yahooFinance
      .chart(yahooSymbol, { period1, interval: "1d", events: "div" })
      .catch(() => null) as Promise<ChartData | null>,
  ])

  const result = buildDividendInfo(symbol, summary, chart)

  cache.set(yahooSymbol, { expiresAt: Date.now() + CACHE_TTL_MS, value: result })
  return result
}

/** Exported for tests: turn raw Yahoo payloads into our domain shape. */
export function buildDividendInfo(
  symbol: string,
  summary: QuoteSummaryData | null,
  chart: ChartData | null
): StockDividendInfo | null {
  if (!summary && !chart) return null

  const history = parseDividendEvents(chart)
  const details = summary?.summaryDetail
  const keyStats = summary?.defaultKeyStatistics

  const newest = history[0]
  const lastDividendPerShare =
    newest?.amountPerShare ??
    (isPositiveNumber(keyStats?.lastDividendValue) ? keyStats.lastDividendValue : null)
  const lastDividendDate = newest?.date ?? toIsoDate(keyStats?.lastDividendDate) ?? null

  const computedTrailing = sumTrailingDividend(history)
  const trailingDividendPerShare =
    computedTrailing ??
    (isPositiveNumber(details?.trailingAnnualDividendRate)
      ? details.trailingAnnualDividendRate
      : null)

  // Without a single known payout there is nothing meaningful to show.
  if (lastDividendPerShare == null && trailingDividendPerShare == null) return null

  const { frequency, medianGapDays } = classifyFrequency(history)

  return {
    symbol,
    currency: summary?.price?.currency ?? details?.currency ?? "IDR",
    lastDividendPerShare,
    lastDividendDate,
    trailingDividendPerShare,
    trailingPaymentCount: countTrailingDividends(history),
    dividendYield: details?.dividendYield ?? null,
    payoutRatio: details?.payoutRatio ?? null,
    frequency,
    medianGapDays,
    // Deliberately no fallback to Yahoo's exDividendDate: for IDX tickers it
    // reports the *last* ex-date, which would surface a past date as "next".
    estimatedNextExDate: estimateNextExDate(lastDividendDate, medianGapDays),
    history,
  }
}

/**
 * Fetch dividend info for many symbols, bounded so a large portfolio does not
 * open dozens of connections at once. Symbols Yahoo has no data for are absent
 * from the returned map rather than mapped to null.
 */
export async function fetchStockDividendInfos(
  symbols: string[]
): Promise<Map<string, StockDividendInfo>> {
  const results = new Map<string, StockDividendInfo>()
  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))]
  if (unique.length === 0) return results

  for (let i = 0; i < unique.length; i += FETCH_CONCURRENCY) {
    const batch = unique.slice(i, i + FETCH_CONCURRENCY)
    const settled = await Promise.all(
      batch.map(async (symbol) => {
        try {
          return [symbol, await fetchStockDividendInfo(symbol)] as const
        } catch (error) {
          console.error(`Failed to fetch dividend info for ${symbol}:`, error)
          return [symbol, null] as const
        }
      })
    )

    for (const [symbol, info] of settled) {
      if (info) results.set(symbol, info)
    }
  }

  return results
}

/** Test helper: clear the per-process dividend cache. */
export function clearDividendCache(): void {
  cache.clear()
}
