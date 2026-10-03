# GrandWealth

A personal wealth management dashboard for tracking expenses, income, gold
deposits, and stock portfolios in one place. Built with Next.js, Prisma, and
NextAuth.

> This is a work-in-progress. The UI is styled for mobile-first use, but a
> proper home-screen widget for iOS and Android is documented at the end of this
> file — a PWA alone cannot render home-screen widgets.

---

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js (App Router, React 19) |
| Language | TypeScript 5 |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth (credentials) |
| UI | shadcn/ui + Tailwind CSS v4 + Radix primitives |
| Charts | recharts |
| Styling | clsx + tailwind-merge + tw-animate-css |
| Icons | Lucide React |
| Validation | Zod (v4) |
| Monetization | Sticky pro trials, admin-managed by an admin |

---

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The database is required for forms, budgets, and the dashboard. Run a migration
first:

```bash
npm run prisma:migrate
npm run prisma:generate
```

Seed a development database if needed:

```bash
npm run prisma:seed
```

---

## Run the tests

```bash
npm test            # run all unit/e2e tests once
npm run test:watch  # watch mode
npm run test:e2e    # Playwright end-to-end suite
```

---

## Project layout

```
src/app
  (dashboard)      # Authenticated dashboard routes (transactions, budgets, gold, stocks, …)
  api/             # Next.js route handlers
  app/page.tsx     # Landing page
  layout.tsx       # Root layout + providers (NextAuth, Theme, React Query)
src/lib          # Shared business logic, validation, prisma client, helpers
src/components   # UI components + page components
src/hooks        # Client hooks (online status, etc.)
prisma           # Schema + migrations
e2e              # Playwright tests
```

---

## Core concepts

### Budget months

Budget months don't have to start on the 1st of the month. A user's budget can
start on any day (1–28) via **Settings → Budget settings**. Every other surface
(accounts, budgets, analysis, transactions, net worth) follows the same rule so
a mid-month start day doesn't split on calendar-month boundaries.

### Net worth

Net wealth = all-time cash + gold value + stock value + savings − debt, where
gold is valued at the latest market price when available.

### Carry-over

Unused budget rolls into the next month by default. A month's *overall*
deficit (expenses > income) also carries into the next month's balance unless
the carry-deficit setting is turned off.

---

## Known limitations

- **No home-screen widgets** on its own. A PWA can be installed, but only
  native code (iOS WidgetKit / Android App Widget) can render home-screen
  widgets. See the next section for the recommended path.
- **No automated sign-up**: accounts require an admin. There is a trial flow,
  but it is admin-managed.
- **No automated payment gateway**: subscription billing is admin-managed.

---

## Home-screen widgets (iOS + Android)

A Next.js PWA can be **installed** (add to home screen, standalone view) but it
cannot render a true home-screen widget. Widgets require native code. The
recommended approach here is a **read-only widget API** that widget apps consume
— that works on both iOS and Android without a native app.

Websites or configuration is only needed where the widget app expects it, and it
doesn't directly create a native widget either.

### 1. Generate a widget token

1. Sign in to GrandWealth.
2. Go to **Settings → Phone Widget**.
3. Click **Generate**. You'll be shown a token once — copy it somewhere safe.
   (Golden rule: this token is shown only once.)

Tokens are per-user, read-only, and SHA-256 hashed. Revoke a token any time.

### 2. Point your widget at the API

For **iOS**, install **Scriptable** and add a script like this:

```js
const token = "PASTE_YOUR_TOKEN_HERE"
const response = await fetch(
  "https://grandwealth.example.com/api/widget/data",
  {
    headers: { "x-widget-token": token },
  },
)
const data = await response.json()
const netCashflow = data.netCashflow
const remainingBudget = data.remainingBudget
const netWorth = data.netWorth
const text = `${netWorth.toLocaleString()}  ·  ${netCashflow.toLocaleString()} this month  ·  ${remainingBudget.toLocaleString()} left this month`
```

Then tap **Add Widget** and pick a **Scriptable** widget. Replace
`grandwealth.example.com` with your deployed URL.

For **Android**, use an HTTP-request/JSON widget app (e.g. KWGT, Tasker with an
HTTP Request element) pointed at the same URL with the `x-widget-token` header.
Bind the fields `netCashflow`, `remainingBudget`, and `netWorth` from the JSON
to your widget.

### 3. What the widget returns

`GET /api/widget/data` returns a compact JSON object:

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

All figures are scoped to the user's current **budget month** (per their
budget-start setting), and net worth is computed from all-time cash plus
gold, stocks, savings, and minus debt.

### 4. Quick add

The landing URL `/transactions?add=1` opens straight into the add-transaction
dialog (optionally with `?add=1&type=EXPENSE`). Point any widget "open app"
action at this URL to jump straight into entering a transaction.

---

## Rate limits

| Endpoint | Limit | Window |
| --- | --- | --- |
| `transactions` GET | 60 | 1 minute |
| `transactions` POST | 30 | 1 minute |
| `budgets` POST | 20 | 1 minute |
| `savings` POST | 20 | 1 minute |
| `gold` POST | 20 | 1 minute |

Rate limits are stored in Upstash Redis when configured; otherwise an in-memory
fallback is used.

---

## Environment variables

Create a `.env.local` from `.env.example` (if present) and fill in:

- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — NextAuth signing secret
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — optional; enables the
  distributed rate limiter
- `ADMIN_EMAILS` / `PRO_TRIAL_DAYS` — admin bootstrap & trial configuration
- `NEXT_PUBLIC_SITE_URL` — public URL (used for canonical metadata / widget deep links)
