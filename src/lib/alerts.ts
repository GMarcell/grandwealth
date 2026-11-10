import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { formatIDR } from "@/lib/utils"
import {
  generateBudgetMonths,
  getBudgetMonthLabel,
  getBudgetMonthRangeInclusive,
} from "@/lib/budget-months"
import {
  buildSpentByMonthCategory,
  computeCarryOverChain,
  type CarryOverEntry,
} from "@/lib/budget-carry-over"

/**
 * Daily email alerts.
 *
 * The cron sends at most one digest per user per day, containing:
 *   - recurring expense bills due within the user's reminder window
 *   - categories that reached the user's warning threshold of their effective
 *     budget (budget + rollover) for the current budget month
 *
 * Every alert item is identified by a stable key recorded in `AlertSend`, so a
 * re-run (or a retried cron invocation) can never email the same bill
 * occurrence or the same budget-month crossing twice.
 */

export type BudgetAlertLevel = "near" | "over"

export interface BillAlert {
  recurringId: string
  description: string
  category: string
  amount: number
  dueDate: Date
  /** "bill:<recurringId>:<YYYY-MM-DD>" — one alert per bill occurrence. */
  key: string
}

export interface BudgetAlert {
  categoryName: string
  month: string
  spent: number
  effectiveAmount: number
  percent: number
  level: BudgetAlertLevel
  /** "budget:<month>:<category>:<level>" — one alert per level per month. */
  key: string
}

export interface AlertEmailData {
  userName: string | null
  monthLabel: string
  bills: BillAlert[]
  budgets: BudgetAlert[]
  siteUrl: string
  /** Reference time for "today" / "tomorrow" labels. */
  now: Date
}

export interface DailyAlertsResult {
  usersChecked: number
  emailsSent: number
  alertsRecorded: number
  skipped: number
}

const REMINDER_DAYS_MIN = 1
const REMINDER_DAYS_MAX = 14
const THRESHOLD_MIN = 50
const THRESHOLD_MAX = 100

export const ALERT_DEFAULTS = {
  billReminderDays: 3,
  budgetAlertThreshold: 80,
}

/**
 * Recurring expense bills whose next occurrence falls on or before
 * `now + reminderDays`. Occurrences already in the past are included too — if
 * the recurring cron failed, "3 days overdue" is exactly what the user needs
 * to know.
 */
export function selectDueBills(
  recurring: Array<{
    id: string
    description: string
    category: string
    amount: number
    nextDate: Date
    endDate: Date | null
  }>,
  now: Date,
  reminderDays: number,
): BillAlert[] {
  const days = Math.min(
    REMINDER_DAYS_MAX,
    Math.max(REMINDER_DAYS_MIN, Math.trunc(reminderDays)),
  )
  const windowEnd = addDays(startOfDay(now), days)
  const cutoff = new Date(windowEnd)
  cutoff.setHours(23, 59, 59, 999)

  return recurring
    .filter((r) => {
      const due = new Date(r.nextDate)
      if (due > cutoff) return false
      // A schedule that has already ended should not be advertised.
      if (r.endDate && due > new Date(r.endDate)) return false
      return true
    })
    .map((r) => {
      const dueDate = new Date(r.nextDate)
      return {
        recurringId: r.id,
        description: r.description,
        category: r.category,
        amount: r.amount,
        dueDate,
        key: `bill:${r.id}:${format(dueDate, "yyyy-MM-dd")}`,
      }
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

/**
 * Current-month budgets that reached `threshold` percent of their effective
 * amount. A category that is already over 100% is reported as "over" instead
 * of "near", so it produces one distinct alert rather than two.
 */
export function selectBudgetAlerts(
  entries: CarryOverEntry[],
  threshold: number,
): BudgetAlert[] {
  const limit = Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, Math.trunc(threshold)))

  return entries
    .filter((e) => e.effectiveAmount > 0)
    .map((e) => {
      const percent = (e.spent / e.effectiveAmount) * 100
      const level: BudgetAlertLevel = percent >= 100 ? "over" : "near"
      return {
        categoryName: e.categoryName,
        month: e.month,
        spent: e.spent,
        effectiveAmount: e.effectiveAmount,
        percent,
        level,
        key: `budget:${e.month}:${e.categoryName}:${level}`,
      }
    })
    .filter((a) => (a.level === "over" ? true : a.percent >= limit))
    .sort((a, b) => b.percent - a.percent)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function dueLabel(dueDate: Date, now: Date): string {
  const days = differenceInCalendarDays(dueDate, now)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
  return `in ${days} days (${format(dueDate, "EEE, d MMM")})`
}

export function alertEmailSubject(data: Pick<AlertEmailData, "bills" | "budgets">): string {
  const { bills, budgets } = data
  const parts: string[] = []
  if (bills.length > 0) {
    parts.push(`${bills.length} bill${bills.length === 1 ? "" : "s"} due`)
  }
  if (budgets.length > 0) {
    parts.push(
      budgets.length === 1
        ? `${budgets[0].categoryName} ${budgets[0].level === "over" ? "over budget" : "near limit"}`
        : `${budgets.length} budgets need attention`,
    )
  }
  return `GrandWealth: ${parts.join(", ")}`
}

/**
 * Render the digest as inline-styled HTML (email clients ignore stylesheets,
 * so every rule stays on the element).
 */
export function renderAlertEmail(data: AlertEmailData): {
  subject: string
  html: string
} {
  const { userName, monthLabel, bills, budgets, siteUrl, now } = data
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,"

  const billsHtml = bills.length
    ? `
      <h2 style="margin:24px 0 8px;font-size:15px;color:#111827;">Upcoming bills</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${bills
          .map(
            (b) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
              <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(b.description)}</div>
              <div style="font-size:13px;color:#6b7280;">${escapeHtml(b.category)} &middot; due ${dueLabel(b.dueDate, now)}</div>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;font-weight:600;color:#111827;white-space:nowrap;">
              ${escapeHtml(formatIDR(b.amount))}
            </td>
          </tr>`,
          )
          .join("")}
      </table>`
    : ""

  const budgetsHtml = budgets.length
    ? `
      <h2 style="margin:24px 0 8px;font-size:15px;color:#111827;">Budget alerts &middot; ${escapeHtml(monthLabel)}</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${budgets
          .map((a) => {
            const over = a.level === "over"
            const color = over ? "#dc2626" : "#d97706"
            const label = over ? "Over budget" : `${Math.round(a.percent)}% used`
            return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
              <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(a.categoryName)}</div>
              <div style="font-size:13px;color:#6b7280;">
                ${escapeHtml(formatIDR(a.spent))} of ${escapeHtml(formatIDR(a.effectiveAmount))}
              </div>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;color:${color};white-space:nowrap;">
              ${escapeHtml(label)}
            </td>
          </tr>`
          })
          .join("")}
      </table>`
    : ""

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border-radius:12px;padding:24px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;">GrandWealth</div>
        <p style="margin:16px 0 0;font-size:15px;color:#374151;">${greeting}</p>
        <p style="margin:8px 0 0;font-size:15px;color:#374151;">
          Here is what needs your attention today.
        </p>
        ${billsHtml}
        ${budgetsHtml}
        <a href="${escapeHtml(siteUrl)}/dashboard"
           style="display:inline-block;margin-top:24px;padding:10px 18px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          Open dashboard
        </a>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
          You are receiving this because daily email alerts are turned on.
          Turn them off anytime in Settings &rarr; Email Alerts.
        </p>
      </div>
    </div>
  </body>
</html>`

  return { subject: alertEmailSubject(data), html }
}

async function getBillAlertsForUser(
  user: {
    id: string
    billReminderDays: number
  },
  now: Date,
): Promise<BillAlert[]> {
  const windowEnd = addDays(startOfDay(now), user.billReminderDays)
  windowEnd.setHours(23, 59, 59, 999)

  const recurring = await prisma.recurringTransaction.findMany({
    where: {
      userId: user.id,
      active: true,
      type: "EXPENSE",
      // Only the next occurrence is stored, so this narrow window is enough.
      nextDate: { lte: windowEnd },
    },
    select: {
      id: true,
      description: true,
      category: true,
      amount: true,
      nextDate: true,
      endDate: true,
    },
  })

  return selectDueBills(recurring, now, user.billReminderDays)
}

async function getBudgetAlertsForUser(user: {
  id: string
  budgetStartDay: number
  carryOverEnabled: boolean
  budgetAlertThreshold: number
}): Promise<BudgetAlert[]> {
  const startDay = user.budgetStartDay
  const months = generateBudgetMonths(13, startDay)
  const currentMonth = months[0]

  const { start } = getBudgetMonthRangeInclusive(months[months.length - 1], startDay)
  const { end } = getBudgetMonthRangeInclusive(currentMonth, startDay)

  const [budgets, expenses] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: user.id, month: { in: months } },
      select: { categoryName: true, month: true, amount: true, rolloverCap: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: { gte: start, lte: end },
      },
      select: { type: true, category: true, amount: true, date: true },
    }),
  ])

  if (!budgets.some((b) => b.month === currentMonth)) return []

  const chain = computeCarryOverChain({
    months,
    budgets,
    spentByMonthCategory: buildSpentByMonthCategory(expenses, startDay),
    carryOverEnabled: user.carryOverEnabled,
  })

  return selectBudgetAlerts(
    [...(chain.get(currentMonth)?.values() ?? [])],
    user.budgetAlertThreshold,
  )
}

/**
 * Send today's digest to every opted-in user who has at least one new alert.
 * Errors are isolated per user so one bad account can't stop the run.
 */
export async function sendDailyAlerts(
  now: Date = new Date(),
): Promise<DailyAlertsResult> {
  const users = await prisma.user.findMany({
    where: { alertsEnabled: true, suspended: false },
    select: {
      id: true,
      email: true,
      name: true,
      budgetStartDay: true,
      carryOverEnabled: true,
      billReminderDays: true,
      budgetAlertThreshold: true,
    },
  })

  const result: DailyAlertsResult = {
    usersChecked: users.length,
    emailsSent: 0,
    alertsRecorded: 0,
    skipped: 0,
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  )

  for (const user of users) {
    try {
      const [bills, budgets] = await Promise.all([
        getBillAlertsForUser(user, now),
        getBudgetAlertsForUser(user),
      ])

      if (bills.length === 0 && budgets.length === 0) {
        result.skipped++
        continue
      }

      // Drop anything already emailed (a bill occurrence or a category's
      // crossing of a level in a given month is only ever sent once).
      const keys = [...bills.map((b) => b.key), ...budgets.map((b) => b.key)]
      const alreadySent = await prisma.alertSend.findMany({
        where: { userId: user.id, key: { in: keys } },
        select: { key: true },
      })
      const sentKeys = new Set(alreadySent.map((a) => a.key))
      const newBills = bills.filter((b) => !sentKeys.has(b.key))
      const newBudgets = budgets.filter((a) => !sentKeys.has(a.key))

      if (newBills.length === 0 && newBudgets.length === 0) {
        result.skipped++
        continue
      }

      const budgetMonthKey =
        newBudgets[0]?.month ?? budgets[0]?.month

      const { subject, html } = renderAlertEmail({
        userName: user.name,
        monthLabel: budgetMonthKey
          ? getBudgetMonthLabel(budgetMonthKey, user.budgetStartDay)
          : "",
        bills: newBills,
        budgets: newBudgets,
        siteUrl,
        now,
      })

      const delivery = await sendEmail({ to: user.email, subject, html })
      if (!delivery.sent) {
        // No provider configured (dev log) or the provider rejected the
        // message. Nothing is recorded, so the next run retries.
        result.skipped++
        continue
      }

      await prisma.alertSend.createMany({
        data: [...newBills, ...newBudgets].map((a) => ({
          userId: user.id,
          key: a.key,
        })),
        skipDuplicates: true,
      })

      result.emailsSent++
      result.alertsRecorded += newBills.length + newBudgets.length
    } catch (error) {
      console.error(`Failed to send daily alerts for user ${user.id}:`, error)
      result.skipped++
    }
  }

  return result
}
