# GrandWealth — Personal Wealth Management

> Track your expenses, income, gold deposits, stock portfolio, and monthly budgets — all in one place.

GrandWealth is a full-stack personal finance dashboard built with **Next.js 16**, **React 19**, **Tailwind CSS 4**, and **PostgreSQL**. It provides a unified view of your financial life with interactive charts, budget tracking with rollover capabilities, live market prices, and support for custom transaction categories.

---

## ✨ Features

### 📊 Dashboard
- **Total Net Wealth** — Combined view of cash flow, gold investments, and stock portfolio value in Indonesian Rupiah (IDR)
- **Income & Expenses** — At-a-glance summaries with surplus/deficit badges
- **Gold & Stocks snapshot** — Total weight/value for gold, stock count for equities
- **Monthly Cash Flow Chart** — Line chart showing income vs expenses over time (powered by Recharts)
- **Wealth Breakdown Pie Chart** — Donut chart visualizing allocation across cash, gold, and stocks
- **Budget Summary Card** — Overall budget progress with rollover tracking, over-budget alerts, and near-limit warnings
- **Recent Transactions** — Last 5 transactions displayed inline
- **Quick Actions** — One-click links to add transactions, set budgets, record gold, or add stocks

### 💸 Transactions
- **Full CRUD** — Create, read, update, and delete income/expense records
- **Type Toggle** — Switch between INCOME and EXPENSE
- **Dynamic Categories** — Pick from predefined categories OR custom user-created ones
- **Search & Filter** — Filter by transaction type (All / Income / Expense) and search by description
- **Budget Alerts** — Toast notifications when adding/editing expenses that push a category near or over budget
- **Amount & Date** — Each transaction records amount (IDR), description, and date

### 🥇 Gold
- **Buy/Sell Recording** — Track gold purchases and sales
- **Weight & Price** — Record weight in grams and price per gram; total is calculated automatically
- **Live Market Price** — Fetches real-time gold price from Yahoo Finance (XAU/USD → IDR/gram), auto-refreshes every 5 minutes
- **Current Value & P&L** — See your portfolio's market value and unrealized profit/loss at a glance
- **Summary Stats** — Total gold weight (g), total invested (IDR), average price per gram, and current market price
- **Transaction History** — Chronological list of all gold transactions with type badges

### 📈 Stocks
- **Portfolio Tracking** — Add stocks with symbol, company name, quantity, and buy price
- **Live Prices** — Fetch current stock prices from Yahoo Finance (supports IDX stocks with `.JK` suffix, e.g., BBCA)
- **Market Value & P&L** — View your portfolio's total market value, unrealized profit/loss, and percentage change
- **Refresh Prices** — One-click button to update all stock prices. Prices are stored in the database
- **Auto-Update via Cron** — Optional scheduled price updates at market open (~09:15 WIB) and close (~16:00 WIB)
- **Summary Stats** — Total number of distinct stocks, total shares, total invested, and total market value
- **Search** — Filter portfolio by symbol or company name

### 🐷 Budgets
- **Monthly Budgets** — Set spending limits per expense category for any month (up to 12 months back)
- **Custom Budget Cycle** — Set the day your budget month starts (default: 1st). Configure in Settings → Budget Cycle
- **Carry-over** — A single global switch (Settings → Budget Cycle → "Carry over unused budget"). When on, each month's unused budget automatically rolls into the next month for every category, and it **compounds** month over month (a month's effective limit is its budget plus everything left unspent before it). It only changes budget limits — it never creates income or transactions, so it doesn't affect net wealth
- **Rollover Cap** — Optional per-category maximum cap on how much unused budget carries forward
- **Effective Amount** — Original budget + rollover = effective spending limit
- **Progress Bars** — Visual indicators showing spent vs effective budget with color coding (green = under 80%, amber = 80-100%, red = over)
- **Over-budget & Near-limit badges** — Categories that exceed or approach their limits are highlighted
- **Budget Allocation Pie Chart** — Visual breakdown of how your total budget is distributed
- **Rollover History Table** — Month-over-month view showing rollover amounts, unused totals, and toggle/cap status per category
- **Month Selector** — View/edit budgets for any of the last 12 months

### ⚙️ Settings
- **Account Info** — Displays user name and email from the session
- **Plan & Subscription** — Live plan/status from the database, including trial countdown and renewal CTA
- **Pro Trial** — Request a free 30-day Pro trial (optionally explaining why). The card tracks the request: awaiting review, trial end date, or already used
- **Password** — Change your own sign-in password (current password + new + confirm)
- **Budget Cycle** — Configure which day of the month your budget period starts (1-28). All budget calculations respect this setting
- **Theme Toggle** — Light / Dark / System mode with persistent preference
- **Custom Categories** — Create, view, and delete custom income/expense categories beyond the predefined set
- **Color Picker** — Assign a color to each custom category for visual identification

### 🎨 UI/UX Highlights
- **Responsive design** — Mobile-first with collapsible sidebar and hamburger menu
- **Light/Dark/System theme** — Full theme support via `next-themes`
- **Skeleton loading** — Skeleton placeholders while data loads
- **Hover states & transitions** — Smooth animations, hover-reveal action buttons, micro-interactions throughout
- **Toast notifications** — Success/error/warning toasts via `sonner`
- **Custom scrollbar** — Styled to match the theme

---

## 💳 Subscriptions & Admin

GrandWealth runs a **Free + Pro subscription** model. The dashboard and
Transactions are free; Pro unlocks budgets, gold/stock tracking, recurring
automation, savings/goals/debts, reports, and AI analysis. Every entitlement
decision is checked against the database (not the session JWT), so admin
changes take effect immediately.

**Per-user fields** (on the `User` model):

| Field                 | Meaning                                                       |
| --------------------- | ------------------------------------------------------------- |
| `plan`                | `FREE` or `PRO`                                               |
| `subscriptionStatus`  | `ACTIVE` / `PAST_DUE` / `CANCELED` / `EXPIRED` (Pro only)     |
| `currentPeriodEnd`    | When Pro access lapses (optional; empty = no end date)        |
| `isTrial`             | Pro access from an admin-approved trial (excluded from MRR)   |
| `role`                | `USER` or `ADMIN` — admins always have full access            |
| `suspended`           | Blocked account (can’t sign in; open sessions land on /suspended) |

**30-day free trial (requested, admin-approved)** — registration lands on the
Free plan; a user asks for a trial from **Settings → Pro Trial**, which records
a `TrialRequest` (one pending request at a time, one trial per account) and
emails every active administrator. An admin approves or declines it from the
admin panel:

- **Approve** grants `PRO` + `ACTIVE` + `isTrial: true` with
  `currentPeriodEnd = now + PRO_TRIAL_DAYS` (30 days) in a single transaction,
  and emails the user their end date.
- **Decline** records the decision (and any note) without touching the plan; the
  user may submit another request later.

The account can't request Pro *and* then keep it silently: entitlements are
evaluated live, so Pro access stops the moment the period ends. The sweep in
`src/lib/trial.ts` (run by the cron endpoints and the admin/subscription
endpoints) then resets the stored plan to FREE so listings and MRR stay
truthful. Trials never create income or transactions, so they don't affect cash
flow or net wealth.

**Subscriptions are admin-managed** (no online billing yet). Bootstrap the
first administrator with the `ADMIN_EMAILS` env var — accounts with those
emails register and sign in as admins:

```env
ADMIN_EMAILS="you@example.com"
```

Admins then manage everything from **/admin** (sidebar → Admin):

- Overview cards: total users, **paying** Pro subscribers, accounts on trial,
  potential MRR (paying × Rp 39.000/month), suspended accounts
- **Trial requests** card at the top of the panel: who asked, when, their note,
  with Approve/Decline actions — plus a badge on the sidebar's Admin entry and
  an email to every admin when a request comes in
- Search/filter the user list (name, email, plan, status, role, suspension)
- Grant or revoke Pro, set subscription status + period end, and mark grants
  as paid or as free trials
- Promote/demote admins, suspend/unsuspend, or permanently delete accounts
  (self-demotion, self-suspension, and deleting the last admin are blocked)
- **Reset a user's password** back to the shared default
  (`DEFAULT_PASSWORD` in `src/lib/password.ts`) — useful for locked-out
  accounts. The admin shares it out-of-band and the user changes it from
  Settings → Password

**Enforcement:** Pro module layouts call `requirePro()` and Pro API routes call
`requireProAccess()`; free users are redirected to `/upgrade`, suspended
accounts to `/suspended`. Background crons (AI analysis, price updates,
recurring automation) only run for entitled Pro users.

---

## 🧱 Tech Stack

| Category       | Technology                                                   |
| -------------- | ------------------------------------------------------------ |
| **Framework**  | [Next.js 16](https://nextjs.org/) (App Router)               |
| **Language**   | TypeScript 5                                                  |
| **UI Library** | React 19                                                      |
| **Styling**    | Tailwind CSS 4 + `tw-animate-css`                            |
| **Components** | Radix UI (Dialog, Select, Switch, Label, Slot, Dropdown Menu) |
| **Icons**      | Lucide React                                                  |
| **Charts**     | Recharts (Line, Pie)                                          |
| **Auth**       | NextAuth.js v5 (Credentials provider, JWT sessions)          |
| **Database**   | PostgreSQL via Prisma ORM with `@prisma/adapter-pg`          |
| **Forms**      | React Hook Form + Zod validation (setup in package.json)      |
| **State Mgmt** | TanStack React Query (server state + caching)                |
| **Theme**      | `next-themes`                                                 |
| **Toasts**     | `sonner`                                                      |
| **Password**   | `bcryptjs`                                                    |
| **Dates**      | `date-fns`                                                    |
| **Fonts**      | Geist (Geist Sans + Geist Mono via Next.js font)             |
| **Market Data**| `yahoo-finance2` (free stock & gold price data)              |
| **Testing**    | Vitest (unit) + Playwright (E2E)                              |

---

## 🏗️ Project Structure

```
grandwealth/
├── prisma/
│   ├── schema.prisma           # Database schema (User, Transaction, GoldDeposit, Stock, Category, Budget, etc.)
│   ├── migrations/             # Database migration files
│   └── seed.ts                 # Seed script with sample data
├── src/
│   ├── app/
│   │   ├── globals.css                  # Tailwind + CSS variables (light & dark themes)
│   │   ├── layout.tsx                  # Root layout with font loading & Providers wrapper
│   │   ├── page.tsx                    # Root page → redirects to /dashboard
│   │   ├── login/
│   │   │   └── page.tsx                # Login form (credentials)
│   │   ├── register/
│   │   │   └── page.tsx                # Registration form
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # Dashboard layout wrapper (Sidebar + main content area)
│   │   │   ├── dashboard/page.tsx      # Main dashboard with charts, stats, budget summary
│   │   │   ├── transactions/page.tsx   # Transactions CRUD with search, filter, budget alerts
│   │   │   ├── budgets/page.tsx        # Monthly budgets with rollover, progress, history
│   │   │   ├── gold/page.tsx           # Gold deposit tracking with live market price
│   │   │   ├── stocks/page.tsx         # Stock portfolio with live price refresh
│   │   │   └── settings/page.tsx       # Account info, budget cycle, theme, custom categories
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts   # NextAuth handler
│   │       │   └── register/route.ts        # User registration
│   │       ├── cron/
│   │       │   └── update-prices/route.ts   # Cron endpoint for scheduled stock price updates
│   │       ├── user/
│   │       │   └── budget-settings/route.ts # User budget start day setting (GET/PATCH)
│   │       ├── dashboard/route.ts           # Aggregated dashboard data
│   │       ├── transactions/
│   │       │   ├── route.ts                 # GET (list), POST (create)
│   │       │   ├── export/route.ts          # CSV export
│   │       │   ├── import/route.ts          # CSV import
│   │       │   └── [id]/route.ts            # PATCH (update), DELETE
│   │       ├── gold/
│   │       │   ├── route.ts                 # GET (list), POST (create)
│   │       │   ├── price/route.ts           # GET (live gold price from Yahoo Finance)
│   │       │   └── [id]/route.ts            # PATCH (update), DELETE
│   │       ├── stocks/
│   │       │   ├── route.ts                 # GET (list), POST (create)
│   │       │   ├── update-prices/route.ts   # POST (refresh all stock prices)
│   │       │   └── [id]/route.ts            # PATCH (update), DELETE
│   │       ├── categories/
│   │       │   ├── route.ts                 # GET (list), POST (create)
│   │       │   └── [id]/route.ts            # PATCH (update), DELETE
│   │       └── budgets/
│   │           ├── route.ts                 # GET (list), POST (create/update)
│   │           ├── [id]/route.ts            # PATCH (update), DELETE
│   │           └── rollover-history/route.ts # GET (month-over-month rollover data)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── dashboard-layout.tsx    # Dashboard shell with mobile sidebar toggle
│   │   │   └── sidebar.tsx             # Sidebar nav with budget alert badge + theme switcher
│   │   └── ui/
│   │       ├── badge.tsx               # Badge component (profit/loss/secondary variants)
│   │       ├── button.tsx              # Button component with variants
│   │       ├── card.tsx                # Card layout components
│   │       ├── dialog.tsx              # Modal dialog
│   │       ├── dropdown-menu.tsx       # Dropdown menu
│   │       ├── error-boundary.tsx      # Error boundary component
│   │       ├── input.tsx               # Text input
│   │       ├── label.tsx               # Form label
│   │       ├── select.tsx              # Select dropdown
│   │       ├── skeleton.tsx            # Skeleton loading placeholder
│   │       └── switch.tsx              # Toggle switch
│   └── lib/
│       ├── auth.ts                     # NextAuth configuration (Credentials + PrismaAdapter)
│       ├── auth.config.ts              # Shared auth config (pages, callbacks, JWT strategy)
│       ├── budget-months.ts            # Budget month helpers (custom start day, date ranges)
│       ├── prices.ts                   # Yahoo Finance price service (gold, stocks)
│       ├── prisma.ts                   # Prisma client singleton (with pg adapter, connection pooling)
│       ├── providers.tsx               # Client-side providers (Session, QueryClient, Theme, Toaster)
│       └── utils.ts                    # Helpers: cn(), formatIDR(), formatCompactIDR(), formatDate(), etc.
├── vitest.config.ts                    # Vitest configuration
├── middleware.ts                       # Auth middleware — protects dashboard routes
├── next.config.ts                      # Next.js configuration
├── vercel.json                         # Vercel deployment & cron job configuration
├── postcss.config.mjs                  # PostCSS config (Tailwind)
├── tsconfig.json                       # TypeScript configuration
├── package.json                        # Dependencies & scripts
└── .gitignore                          # Git ignore rules
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 14+ (or a hosted Postgres instance like Neon, Supabase, etc.)
- **npm** (or pnpm/bun — check `package.json` for the project's package manager)

### 1. Clone & Install

```bash
git clone <repository-url>
cd grandwealth
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/grandwealth?schema=public"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

| Variable          | Description                                       |
| ----------------- | ------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string                      |
| `NEXTAUTH_SECRET` | Random string used to encrypt JWT tokens (run `openssl rand -hex 32` to generate) |
| `NEXTAUTH_URL`    | Full URL of your app (local: `http://localhost:3000`) |
| `CRON_SECRET`     | Secret that authorizes the cron endpoints (update-prices, apply-recurring, monthly-analysis). Required — the endpoints fail closed (HTTP 500) without it |
| `ADMIN_EMAILS`    | Comma-separated emails granted the ADMIN role at registration/sign-in — bootstraps the first admin, who manages subscriptions from /admin |

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates tables)
npm run prisma:migrate

# (Optional) Seed with sample data
npm run prisma:seed

# (Optional) Open Prisma Studio to inspect data
npm run prisma:studio
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Register a new account to get started.

### Available Scripts

| Script                    | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `npm run dev`             | Start the Next.js dev server                     |
| `npm run build`           | Build for production (`prisma generate` + `next build`) |
| `npm run start`           | Start the production server                      |
| `npm run test`            | Run all unit tests (Vitest)                      |
| `npm run test:watch`      | Run tests in watch mode                          |
| `npm run lint`            | Run ESLint                                       |
| `npm run prisma:generate` | Generate Prisma client                           |
| `npm run prisma:migrate`  | Run database migrations                          |
| `npm run prisma:studio`   | Open Prisma Studio GUI                           |
| `npm run prisma:seed`     | Run the seed script                              |

---

## 🗄️ Database Schema

The database uses **PostgreSQL** with **Prisma ORM**. Key models:

| Model                  | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| **User**               | User accounts with email/password auth + `budgetStartDay` and `carryOverEnabled` budget settings, plus role/plan/subscription fields (`plan`, `subscriptionStatus`, `currentPeriodEnd`, `isTrial`, `role`, `suspended`) for the Free+Pro model |
| **Account**            | NextAuth account linking (for future OAuth)              |
| **Session**            | NextAuth sessions (JWT strategy currently used)          |
| **VerificationToken**  | NextAuth verification tokens                             |
| **Transaction**        | Income/expense records (type, category, amount, description, date) |
| **Category**           | Custom user-defined categories with name, type, and color |
| **Budget**             | Monthly spending limits per category (with optional carry-over cap) |
| **GoldDeposit**        | Gold buy/sell records (weight, price, total)             |
| **Stock**              | Stock portfolio entries (symbol, name, quantity, buy price, current price) |
| **RecurringTransaction** | Recurring income/expense schedules (WEEKLY, MONTHLY, YEARLY) |

See [prisma/schema.prisma](./prisma/schema.prisma) for the full schema with field details, constraints, and relations.

---

## 🔌 API Routes

All API routes are prefixed under `/api/`. All endpoints (except auth and cron) require authentication — they validate the session via `auth()` and return `401` if unauthorized.

| Route                                 | Method   | Description                                    |
| ------------------------------------- | -------- | ---------------------------------------------- |
| **Auth**                              |          |                                                |
| `/api/auth/register`                  | `POST`   | Register a new user (email, name, password)     |
| `/api/auth/[...nextauth]`             | `GET/POST` | NextAuth handler (login, session, signout)    |
|                                       |          |                                                |
| **Dashboard**                         |          |                                                |
| `/api/dashboard`                      | `GET`    | Aggregated wealth overview, stats, charts      |
|                                       |          |                                                |
| **User Settings**                     |          |                                                |
| `/api/user/budget-settings`           | `GET`    | Get the user's budget start day setting        |
| `/api/user/budget-settings`           | `PATCH`  | Update the user's budget start day (1-28)      |
| `/api/user/password`                  | `PATCH`  | Change your own password (current + new)       |
| `/api/user/trial-request`             | `GET`    | Your trial state (eligible, pending, end date) |
| `/api/user/trial-request`             | `POST`   | Request a Pro trial (notifies the admins)      |
|                                       |          |                                                |
| **Admin**                             |          |                                                |
| `/api/admin/overview`                 | `GET`    | User/subscription aggregates                   |
| `/api/admin/users`                    | `GET`    | List users (search + filters + pagination)     |
| `/api/admin/users/[id]`               | `PATCH`  | Update role, plan, status, suspension          |
| `/api/admin/users/[id]`               | `DELETE` | Delete a user (and all their data)             |
| `/api/admin/users/[id]/reset-password`| `POST`   | Reset a user's password to the default         |
| `/api/admin/trial-requests`           | `GET`    | List trial requests (pending first)            |
| `/api/admin/trial-requests/[id]`      | `PATCH`  | Approve (30 days of Pro) or decline a request  |
|                                       |          |                                                |
| **Transactions**                      |          |                                                |
| `/api/transactions`                   | `GET`    | List all transactions (descending by date)     |
| `/api/transactions`                   | `POST`   | Create a transaction                           |
| `/api/transactions/export`            | `GET`    | Export all transactions as CSV                 |
| `/api/transactions/import`            | `POST`   | Import transactions from CSV file (≤2 MB, ≤5000 rows, 5/min) |
| `/api/transactions/[id]`              | `PATCH`  | Update a transaction                           |
| `/api/transactions/[id]`              | `DELETE` | Delete a transaction                           |
|                                       |          |                                                |
| **Gold**                              |          |                                                |
| `/api/gold`                           | `GET`    | List all gold deposits                         |
| `/api/gold`                           | `POST`   | Record a gold buy/sell                         |
| `/api/gold/price`                     | `GET`    | Get live gold price (XAU/USD → IDR/gram)       |
| `/api/gold/[id]`                      | `PATCH`  | Update a gold record                           |
| `/api/gold/[id]`                      | `DELETE` | Delete a gold record                           |
|                                       |          |                                                |
| **Stocks**                            |          |                                                |
| `/api/stocks`                         | `GET`    | List all stock holdings (with current prices)  |
| `/api/stocks`                         | `POST`   | Add a stock                                    |
| `/api/stocks/update-prices`           | `POST`   | Refresh current prices for all user's stocks   |
| `/api/stocks/[id]`                    | `PATCH`  | Update a stock                                 |
| `/api/stocks/[id]`                    | `DELETE` | Delete a stock                                 |
|                                       |          |                                                |
| **Categories**                        |          |                                                |
| `/api/categories`                     | `GET`    | List custom categories                         |
| `/api/categories`                     | `POST`   | Create a custom category                       |
| `/api/categories/[id]`                | `PATCH`  | Update a category                              |
| `/api/categories/[id]`                | `DELETE` | Delete a category                              |
|                                       |          |                                                |
| **Budgets**                           |          |                                                |
| `/api/budgets`                        | `GET`    | List all budgets                               |
| `/api/budgets`                        | `POST`   | Create or update a budget (upsert)             |
| `/api/budgets/[id]`                   | `PATCH`  | Update a budget                                |
| `/api/budgets/[id]`                   | `DELETE` | Delete a budget                                |
| `/api/budgets/rollover-history`       | `GET`    | Month-over-month rollover data per category    |
|                                       |          |                                                |
| **Cron (Scheduled Jobs)**             |          |                                                |
| `/api/cron/update-prices`             | `GET`    | Update stock prices for ALL users (scheduled)  |

### Auth & Middleware

Authentication uses **NextAuth.js v5** with the **Credentials** provider (email + password). Passwords are hashed with bcryptjs (12 salt rounds). The middleware at `src/middleware.ts` protects all dashboard routes; unauthenticated users are redirected to `/login`.

Session strategy: **JWT** (no database sessions). The JWT token carries the user ID, accessible server-side via `auth()` and client-side via `useSession()`.

---

## 🖥️ Pages & Routes

| Path              | Description                                   | Auth Required |
| ----------------- | --------------------------------------------- | ------------- |
| `/`               | Redirects to `/dashboard`                     | No            |
| `/login`          | Sign-in page (email + password)               | No            |
| `/register`       | Create an account                             | No            |
| `/dashboard`      | Main dashboard with wealth overview           | Yes           |
| `/transactions`   | Transaction list and CRUD                     | Yes           |
| `/gold`           | Gold deposit tracking with live price         | Yes           |
| `/stocks`         | Stock portfolio with live price refresh       | Yes           |
| `/budgets`        | Budget management with rollover               | Yes           |
| `/settings`       | Account info, budget cycle, theme, categories | Yes           |

---

## 🎨 Theming

GrandWealth supports **light**, **dark**, and **system** themes via `next-themes`. The theme is persisted in local storage and toggled from the sidebar user menu (DropdownMenu) or the Settings page.

CSS custom properties for colors are defined in `src/app/globals.css` using the `oklch()` color space. All components reference these variables via Tailwind's `@theme inline` directive, ensuring seamless theme switching.

---

## 🧩 Key Architecture Decisions

- **Server-side data** fetched via **React Query** (`@tanstack/react-query`) with a 30s stale time, auto-refetch on the dashboard every 60s, and sidebar budget badge refresh every 120s
- **Currency formatting** is in **Indonesian Rupiah (IDR)** using `Intl.NumberFormat` with compact variants (e.g., `Rp1,5jt`, `Rp2,5M`)
- **Budget cycle** uses a configurable start day (1-28). Budget month keys are stored as `YYYY-MM` (keyed by the calendar month the period *starts* in) but their date ranges shift based on the user's `budgetStartDay` setting. A budget month is **named after the month it ends in**: with `budgetStartDay = 28`, the period 28 Aug – 27 Sep is labelled "Sep 2026". All budget calculations (expense filtering, rollover, alerts) use `getBudgetMonthRange()` to compute the correct date window, and all labels go through `getBudgetMonthLabel()`. The dashboard **Monthly Cash Flow** and **Net Wealth Trend** charts also bucket by budget month. The dashboard's transaction fetch window starts at the oldest budget month in its chain and its "all-time" cash cutoff is the **end of the current budget month** (not the calendar month), so `totalWealth` matches the latest net-worth chart point — reports, transactions, budgets, and analysis all follow the same cycle
- **Monthly AI analysis** is only ever generated for a user's **last complete budget month** — the budget month immediately before the one currently running — via `getLastCompletedBudgetMonthKey()` / `generateCompletedBudgetMonths()` in `src/lib/budget-months.ts`. The Analysis page never offers the in-progress budget month, the `POST /api/analysis` endpoint rejects it with a 400, and the `monthly-analysis` cron uses the same helper per user (each user's period depends on their own `budgetStartDay`). This prevents a report being produced from a partial, still-running period (e.g. on 21 Sep a 15th-start budget month, the report covers 15 Aug – 14 Sep, labelled "Sep 2026")
- **Budget carry-over** calculation lives in `src/lib/budget-carry-over.ts` (`computeCarryOverChain`) and is shared by the budgets page, dashboard, and rollover-history API. For each month `unused = max(0, effectiveAmount − spent)`, and the following month's `effectiveAmount = amount + min(unused, rolloverCap)`. Because each month carries the previous month's effective leftover, unused budget **compounds** across months. It resets when a category has no budget in a month, and the global `carryOverEnabled` switch turns it all off. Carry-over is a budgeting figure only — it never writes income/transactions, so net wealth is unaffected
- **Monthly balance carry-over** is separate and lives in `src/lib/monthly-balance.ts` (`computeMonthlyBalanceChain`). It tracks the user's OVERALL running balance — `balance = previous balance + (income − expenses)` — so a month whose expenses exceed its income carries a **negative** balance (a deficit) into the next month, while a surplus carries forward the same way. It is always on (independent of the per-category `carryOverEnabled` switch), seeds each window with the balance held beforehand so `balance` is a real figure, and is surfaced on the dashboard's Monthly Cash Flow chart (dashed "Carried balance" line) and the Net Cash Flow card's carried-balance figure. The dashboard exposes it as `monthlyData[].{net,carryIn,balance}` plus a top-level `carriedBalance`
- **Category system** merges predefined categories (hardcoded) with user-created custom categories. Both are available in the transaction form based on the selected type (INCOME/EXPENSE)
- **Market prices** are fetched from Yahoo Finance via the `yahoo-finance2` package. Gold uses `XAUUSD=X` + `IDR=X` to compute IDR/gram. IDX stocks use the `.JK` suffix (e.g., `BBCA.JK`)
- **Stock prices** are persisted in the database (`currentPrice` + `lastPriceUpdated` on the Stock model). They can be refreshed on-demand from the UI or via a scheduled cron job
- **Mobile responsiveness**: The sidebar collapses off-screen on mobile with a backdrop overlay. The main content area uses `lg:ml-64` offset on desktop

---

## 🤖 Market Price Integration

### Gold Prices
- The gold page fetches live spot gold prices from Yahoo Finance
- Price calculation: (XAU/USD ÷ 31.1035) × USD/IDR = IDR per gram
- Auto-refreshes every 5 minutes; manual refresh button available
- Shows current portfolio value and unrealized P&L based on live prices

### Stock Prices
- Add stocks with their ticker symbol (e.g., `BBCA` for Bank Central Asia)
- Click **Refresh Prices** to fetch live prices via Yahoo Finance (`.JK` suffix for IDX stocks)
- Prices are stored in the database and returned on page load
- Dashboard uses `currentPrice` when available, falling back to `buyPrice`

### Cron Job Setup (Automated Price Updates)

To automatically update stock prices at market open (~09:15 WIB) and close (~16:00 WIB):

1. Set the `CRON_SECRET` environment variable in your deployment
2. Configure the cron schedule:

**Vercel (requires Pro plan):** The `vercel.json` file already has cron job definitions:
```json
{
  "crons": [
    { "path": "/api/cron/update-prices", "schedule": "15 2 * * *" },
    { "path": "/api/cron/update-prices", "schedule": "0 9 * * *" }
  ]
}
```
These run at 02:15 UTC (09:15 WIB) and 09:00 UTC (16:00 WIB).

**Alternative (cron-job.org, GitHub Actions, etc.):**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/update-prices
```

---

## 🧪 Testing

Unit tests use **Vitest** and are located alongside the source files in `__tests__` directories.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Unit Tests
- `src/lib/__tests__/budget-months.test.ts` — 23 tests covering all budget month helper functions (key generation, date ranges, labels, edge cases)

### E2E Tests (Playwright)

E2E tests use **Playwright** to test the full budget cycle flow in a browser. Tests are in the `e2e/` directory.

**Prerequisites:**
- The app must be running (use `npm run dev`)
- A PostgreSQL database with migrations applied

**Setup & Run:**

```bash
# Start the dev server (in one terminal)
npm run dev

# Run E2E tests (in another terminal)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with Playwright UI mode
npm run test:e2e:ui
```

**Test auth:** The first time tests run, a test user is automatically registered and logged in via the setup project. The authenticated state is saved to `e2e/.auth/user.json` and reused across tests.

**Test coverage:**
- Settings page — Budget Cycle card visibility, start day selection, save/reset, example date range display
- Budgets page — Month selector, month labels reflecting start day, add budget dialog
- API endpoints — GET/PATCH `/api/user/budget-settings`, validation of invalid values (returns 400)
- Password endpoints — `PATCH /api/user/password` (verifies the current password, first-time set for OAuth-only accounts) and `POST /api/admin/users/[id]/reset-password` (admin-only, resets to the default)
- Trial requests — the eligibility helper (`src/lib/trial-request.ts`: one pending request, one trial per account, lapsed trials) plus `GET/POST /api/user/trial-request` and the admin list/decide endpoints (approval grants exactly 30 days and notifies the user; declining leaves the plan alone)

---

## 🚢 Deployment

1. Set the environment variables on your hosting platform (Vercel, Railway, Fly.io, etc.)
2. Point `DATABASE_URL` to your production PostgreSQL instance
3. Run migrations: `npx prisma migrate deploy`
4. Build & deploy: `npm run build && npm run start`

For **Vercel** specifically:
- The build command `npm run build` already includes `prisma generate`
- Ensure the Prisma client binary targets match your deployment environment
- Cron jobs (in `vercel.json`) require **Pro plan** or above
- Set `CRON_SECRET` in the Vercel Dashboard under **Settings → Environment Variables**

---

## 📝 License

This is a private/internal project. All rights reserved.
