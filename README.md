# GrandWealth

A personal wealth management dashboard for tracking expenses, income, gold
deposits, and stock portfolios in one place. Built with Next.js, Prisma, and
NextAuth.

> **Home-screen widgets need native code**, which a Next.js PWA can't provide.
> This README documents the recommended workaround (a read-only widget API +
> a standalone widget app) further down.

---

## Quick start

```bash
npm install
npm run prisma:migrate   # create the database tables
npm run prisma:generate  # generate the Prisma client
npm run dev              # http://localhost:3000
```

Run the tests anytime:

```bash
npm test        # run once
npm run test:watch
npm run test:e2e
```

---

## Project layout

```
src/app
  (dashboard)/     Authenticated pages: transactions, budgets, gold, stocks,
                   savings, goals, debts, recurring, analysis, settings, …
  api/             Next.js route handlers (including /api/widget/data)
  app/             Landing page + root layout
src/lib            Business logic, validation, Prisma client, auth, rate limits
src/components     UI components + per-page components
src/hooks          Client hooks (e.g. online-status)
prisma             Schema + migrations
e2e                Playwright end-to-end tests
```

---

## Core concepts

### Budget months

Budget months can start on any day (1–28), set in **Settings → Budget settings**.
Every surface in the app (accounts, budgets, analysis, transactions, net worth)
follows the same rule, so a mid-month start day never shows a transaction in
the wrong month. Each budget month is named after the calendar month it
*ends* in.

### Net worth

Net wealth = **all-time cash** + **gold value** + **stock value** + **savings**
− **debt**.

- Gold is valued at the latest market price whenever it can be fetched;
  falls back to cost basis.
- All-time cash is the sum of every transaction in history, not just the 13
  months shown in the charts.

### Carry-over

Unused budget rolls into the next month. A month's *overall* deficit (expenses
> income) also carries into the next month's balance by default, unless the
**carry-deficit** switch is off.

---

## Rate limits

| Endpoint | Limit | Window |
| --- | --- | --- |
| `transactions` GET | 60 | 1 minute |
| `transactions` POST | 30 | 1 minute |
| `budgets` POST | 20 | 1 minute |
| `savings` POST | 20 | 1 minute |
| `gold` POST | 20 | 1 minute |

Stored in Upstash Redis when configured; otherwise a local in-memory fallback.

---

## Environment variables

Create a `.env.local` (from `.env.example` if you have one) and fill in:

- `DATABASE_URL` — PostgreSQL
- `AUTH_SECRET` — NextAuth signing secret
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — optional; enables the
  distributed rate limiter
- `ADMIN_EMAILS` / `PRO_TRIAL_DAYS` — admin bootstrap & trial configuration
- `NEXT_PUBLIC_SITE_URL` — public URL (canonical metadata + widget deep links)

---

## Home-screen widgets on iOS and Android

### The honest limitation

A Next.js PWA can be **installed** (add to home screen, standalone view), but
it **cannot render a home-screen widget**. Widgets on iOS (WidgetKit) and
Android (App Widget) are **native-only**, and a webpage has no API to open
that system registry.

The fix is to ship a **read-only widget API** that a standalone widget app
feeds. That works on both iOS and Android without building a native app. The
widget does nothing to your data — it is purely a window into the figures.

### The plan, in four steps

1. **Generate a read-only token** in Settings so the widget can be authenticated.
2. **Point a widget app at the API** using that token.
3. **Add the widget** to your home screen and format the fields you care about.
4. **Optionally link straight to quick-add** so a tap opens the add-dialog.

### Step 1 — Generate a widget token

1. Sign in and go to **Settings → Phone Widget**.
2. Tap **Generate**. You'll see a **token** — copy it immediately. It is shown
   exactly once; after that only the first characters (`prefix`) are stored.
3. (Optional) Give it a label like `iPhone widget` so you can tell tokens
   apart. You can revoke any token later.

Tokens are stored as a SHA-256 hash, never in plaintext.

### Step 2 — Point a widget app at the API

The API endpoint is:

```
https://grandwealth.example.com/api/widget/data
```

It requires a bearer widget token in the `x-widget-token` header. It returns a
compact JSON object:

```json
{
  "monthKey": "2026-07",
  "monthLabel": "Aug",
  "netCashflow": 150000,
  "income": 800000,
  "expenses": 650000,
  "remainingBudget": 120000,
  "totalBudgeted": 200000,
  "totalSpent": 80000,
  "netWorth": 12345678,
  "updatedAt": "2026-08-14T00:00:00.000Z"
}
```

### iOS — Scriptable (recommended)

1. Install **Scriptable** from the App Store.
2. Create a new script and paste:

   ```js
   const token = "PASTE_YOUR_TOKEN_HERE"
   const response = await fetch(
     "https://grandwealth.example.com/api/widget/data",
     { headers: { "x-widget-token": token } }
   )
   const data = await response.json()

   const netWorth = data.netWorth
   const netCashflow = data.netCashflow
   const remainingBudget = data.remainingBudget

   const text = `${netWorth.toLocaleString()}   Net worth`
   const detail = `${netCashflow >= 0 ? "+" : ""}${netCashflow.toLocaleString()}  this month`
   const annotation = `${remainingBudget >= 0 ? "+" : ""}${remainingBudget.toLocaleString()}  left this month`

   Script.setWidgetProperty("title", "GrandWealth")
   Script.setWidgetProperty("text", text)
   Script.setWidgetProperty("detail", detail)
   Script.setWidgetProperty("annotation", annotation)
   Script.setWidgetProperty("canChart", false)
   Script.complete()
   ```

3. Tap **Add Widget** → choose a small **Scriptable** widget.
4. Tap the widget once and set a colour you like.
5. Replace `grandwealth.example.com` with your deployed URL (see next section).

### Android — KWGT

1. Install **KWGT** from the Play Store.
2. Long-press your home screen → **Widgets** → **KWGT** → **Add widget**.
3. Choose an **HTTP Request** widget.
4. Fill in **Builder 1** (or the equivalent):
   - URL: `https://grandwealth.example.com/api/widget/data`
   - Header: `x-widget-token` = `PASTE_YOUR_TOKEN_HERE`
   - Method: `GET`
5. Map the fields:
   - `netWorth` → Number
   - `netCashflow` → Number
   - `remainingBudget` → Number
6. Save, then **Done**. Add the widget to your home screen.

### Formatting the numbers

You can leave KWGT's built-in **Calculator** fields for each mapped number, or
add an **HTML** widget that draws one line:

```html
<div style="font-size:20px;font-weight:bold">
  Net worth Rp12.345.678
</div>
<div style="font-size:14px">
  This month +Rp150.000 &middot; Rp120.000 left
</div>
```

**KWGT HTML widget** does not support JS, so you must pre-format each number
with a Calculator field before embedding. If you prefer, I can generate a
KWGT **HTML widget setup** file that does this for you.

### Android — true home-screen widget (native app)

If you want a widget that appears in Android's own widget picker (not inside
KWGT), that requires a native Android app with an **App Widget**. Two options:

- **Easiest:** wrap the PWA in a **TWA (Trusted Web Activity)** — the web app
  is the widget, but the "widget" itself is still the web page, not a native
  widget.
- **Real native widget:** write a small Kotlin app with an `AppWidgetProvider`
  that fetches `https://grandwealth.example.com/api/widget/data` and renders
  the figures. This is the only path that gives you a native widget, and it
  requires a Play Store build (or sideloading).

### Quick add — open straight to entering a transaction

The deep link:

```
https://grandwealth.example.com/transactions?add=1
```

opens the add-transaction dialog immediately. Add `?add=1&type=EXPENSE` to
preselect an expense. Point any widget tap at this URL for a true one-tap
add.

---

## Legacy — what to delete when you're done

- `prisma/migrations/20260929000000_add_carry_deficit_setting/migration.sql`
- `prisma/seed.ts` (if unused)
