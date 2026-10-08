# GrandWealth — Product Requirements Document (PRD)

## Project Overview

**Project Name:** GrandWealth  
**Type:** Full-stack personal finance dashboard / web app  
**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma, PostgreSQL, NextAuth v5 (beta), TanStack React Query, Recharts, Radix UI, Yahoo Finance API, Groq AI SDK

### One-line Summary
A personal wealth management dashboard for individuals (primarily in Indonesia) that tracks income/expenses, gold holdings, stock portfolios, savings accounts, loans, recurring transactions, and budgets — with an AI-powered monthly analysis and a read-only phone-widget API.

---

## Background

### Problem
Personal finance tools are usually fragmented: budgeting apps don't track investments, brokerage tools don't show daily spending, and spreadsheets are cumbersome. In the Indonesian market there is no single, modern, localized (IDR, gold, IDX stocks) app that combines all of these in one place.

### Why This Exists
GrandWealth is a single-pane-of-glass for personal finances. It brings together:
- Cash flow (income / expenses)
- Gold investments (buy/sell tracking + live market price)
- Stock portfolio (IDX-friendly, live prices from Yahoo Finance)
- Bank savings accounts
- Loans / debt tracking
- Recurring transactions
- Monthly budgets with rollover
- AI-generated monthly financial analysis
- A read-only widget API for iOS/Android home-screen widgets

### Target Users
- Indonesian professionals / small business owners tracking salary, freelance income, gold, and IDX stocks
- Budget-conscious savers who want rollover budgets, savings goals, and 50/30/20 analysis

### Scope of the PRD
This PRD describes the **current v0.1.0 feature set** as implemented in this repository, plus areas flagged for improvement.

---

## Features

### 1. Authentication & Accounts
- Email/password registration and login via NextAuth v5 (Credentials provider, JWT sessions)
- Protected dashboard routes (middleware + `auth()` guards on API routes)
- Password reset / forgot-password flow
- Suspendable accounts; role-based access (USER / ADMIN)

### 2. Dashboard (Overview)
- **Total Net Wealth** hero: all-time net cash flow + gold value + stock value + savings − debt
- **KPIs:** total income, total expenses, net cash flow, carried balance, total assets (gold + stocks + savings), debt
- **Charts:**
  - Monthly cash flow line chart (income vs expenses over last 13 budget months)
  - Wealth breakdown pie chart (cash / gold / stocks / savings)
  - Net worth history chart (12-month trend)
- **Budget summary card:** total budgeted, rollover, spent, remaining, over-budget & near-limit alerts
- **50/30/20 budget rule widget:** Needs / Wants / Savings breakdown with progress bars and health badge
- **AI monthly analysis widget:** latest generated analysis summary with key metrics
- **Recent transactions:** last 5 transactions inline
- **Quick actions:** one-tap links to add transaction / set budgets / record gold / add stock / record savings
- Auto-refresh every 60 seconds; manual refresh button

### 3. Transactions
- CRUD for income/expense transactions (type, category, amount, description, date)
- Paginated list with search (debounced) and type filter
- Predefined categories + custom user categories with colors
- CSV export and CSV import (xlsx-based parsing)
- Rate-limited API (GET: 60/min, POST: 30/min)

### 4. Gold Tracking
- Record gold BUY/SELL transactions (weight in grams, price per gram, total amount, notes)
- Live market price fetched from Yahoo Finance (with short timeout fallback to cost basis)
- Portfolio summary: total weight, total invested, avg price, current price, market value, unrealized P&L
- Price auto-refresh every 5 minutes
- Rate-limited API (POST: 20/min)

### 5. Stock Portfolio
- Add/edit/delete stock holdings (symbol, company name, quantity in lots, buy price per lot, purchase date, notes)
- Quantity is in **lots** (1 lot = 100 shares); Yahoo Finance prices are per share and converted
- Live prices fetched from Yahoo Finance (IDX support)
- Summary cards: total stocks, total lots, total invested, market value, total P&L + %
- Refresh prices button + scheduled cron job for price updates
- Stock search combobox (Yahoo Finance search API)
- Dividends panel (dividend tracking, upcoming dividends, trailing dividend summaries)
- Rate-limited API

### 6. Budget Management
- Monthly budgets per expense category with configurable amounts
- **Custom budget cycle:** user picks a budget start day (1–28); every surface follows the same cycle so mid-month starts don't split transactions across calendar months
- **Rollover:** unused budget carries into next month; optional per-category rollover cap
- **Effective budget = original + rollover**
- **Carry-over chain:** compounded across last 13 budget months
- **Carry-deficit setting:** global switch; when off, monthly deficits don't carry forward (months start fresh after a deficit)
- Progress bars (green/amber/red), over-budget and near-limit (80%+) badges
- Month selector to view/edit any of last 12 months
- Budget allocation chart, rollover history
- AI budget plan endpoint (Groq) that suggests budgets from prior-month actuals
- Rate-limited API (POST: 20/min)

### 7. Bank Savings
- Record deposits/withdrawals per savings account (account name, amount, date, notes)
- Summary: total savings across accounts; count of distinct accounts

### 8. Loans / Debt
- Track loans (name, principal, remaining balance, interest rate, monthly payment, start date, notes)
- Summary: total debt, loan count
- Net wealth formula subtracts total remaining balance

### 9. Recurring Transactions
- Weekly/monthly/yearly recurring income/expense transactions
- Start date, optional end date, next occurrence date, active/inactive toggle
- Can be linked to a savings goal
- Cron job applies recurring transactions on schedule

### 10. Savings Goals
- Goal name, target amount, saved amount, target date, color
- Linked recurring deposits can feed a goal
- AI goal-plan endpoint (Groq) that produces a realistic plan to reach a goal by its deadline

### 11. Financial Reports
- Monthly bar chart (income vs expenses) and category pie chart
- Date range filtering
- Summary stats for the selected period

### 12. AI Monthly Analysis
- Generates a Markdown analysis for a completed budget month using Groq
- Includes income, expenses, net savings, savings rate, top category, over-budget count
- **Completion guard:** only completed (ended) budget months can be analyzed; in-progress months are excluded
- Regenerate with cancel support; inline error messages (rate limit, Pro-only, empty month, etc.)

### 13. Settings
- Account info (name, email)
- **Budget settings:** start day (1–28), carry-over on/off, carry-deficit on/off
- Theme toggle (light / dark / system) via next-themes
- Custom categories: create, edit, delete with color picker and rule type (NEED / WANT / SAVINGS)
- 50/30/20 rule-type assignment per category
- Subscription / Pro trial request flow (admin-managed)
- Widget token management (generate / revoke)

### 14. Phone Widgets (Read-Only)
- Settings → generate a widget token (shown once, stored as SHA-256 hash, identifiable by prefix/label)
- `/api/widget/data` endpoint returns compact JSON: monthKey, monthLabel, netCashflow, income, expenses, remainingBudget, totalBudgeted, totalSpent, netWorth, updatedAt
- Bearer token in `x-widget-token` header; read-only (no write access)
- Documented integrations: iOS Scriptable script, Android KWGT HTTP widget, deep link to quick-add transaction

### 15. Offline Queue / Resilience
- `OfflineSyncProvider` + offline queue for mutations when the device is offline
- Idempotency keys on writes so replayed requests don't double-apply
- Online/offline banner and status hook

### 16. Admin Features
- Admin users can view all users, reset passwords, manage trial requests
- Admin bootstrap via `ADMIN_EMAILS` env var on first registration
- Trial requests: users request Pro trial from Settings; admin approves/declines; trial auto-expires after `PRO_TRIAL_DAYS`

### 17. Cron Jobs (Vercel Cron)
- `apply-recurring` — applies recurring transactions
- `update-prices` — refreshes stock prices across users
- `monthly-analysis` — generates AI analysis for completed months
- All protected by `CRON_SECRET`

---

## Technical Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.9 (App Router) |
| Language | TypeScript 5 |
| UI | React 19.2.4 |
| Styling | Tailwind CSS 4 + tw-animate-css |
| Icons | Lucide React |
| Charts | Recharts 3 |
| UI Primitives | Radix UI (dialog, select, switch, popover, command, etc.) |
| Data Fetching / Cache | TanStack React Query 5 |
| Forms | React Hook Form 7 + Zod 4 |
| Toasts | Sonner 2 |
| Theme | next-themes 0.4 |
| Auth | NextAuth v5 beta 31 (Credentials + JWT) |
| Database | PostgreSQL (prisma provider) |
| ORM | Prisma 5.22 |
| Password hashing | bcryptjs |
| Dates | date-fns 4 |
| Market data | yahoo-finance2 3 |
| AI | Groq SDK 1 |
| Rate limiting | @upstash/ratelimit + @upstash/redis (falls back to in-memory) |
| CSV/Excel | xlsx 0.18, pdf-lib 1.17 |
| Testing | Vitest 4, Playwright 1.61, Testing Library |
| Lint | ESLint 9 + eslint-config-next |
| Build | rolldown (via next.config) |
| Hosting | Vercel (with Vercel Cron) |

### Architecture Notes
- Route groups: `(dashboard)` for authenticated pages sharing a shell layout
- API routes under `src/app/api/*`
- Business logic in `src/lib/` (prices, budget-months, budget-carry-over, monthly-balance, wealth-history, gold, dividends, analysis-generator, subscription, trial, widget-token, rate-limit, offline-queue, api-mutate, idempotency, etc.)
- UI components in `src/components/` (ui primitives, layout, charts, auth, chatbot, stocks, settings, offline)
- Prisma schema in `prisma/schema.prisma` with migrations in `prisma/migrations/`

### Data Model Highlights
- `User`: id, name, email, password, role, plan, subscriptionStatus, currentPeriodEnd, isTrial, suspended, budgetStartDay, carryOverEnabled, carryDeficitEnabled; relations to transactions, goldDeposits, stocks, categories, budgets, recurringTransactions, monthlyAnalyses, bankSavings, savingsGoals, loans, dividends, accounts, sessions, trialRequests, widgetTokens
- `Transaction`: type (INCOME/EXPENSE), category, amount, description, date; indexed on (userId, date), (userId, type, date)
- `GoldDeposit`: type (BUY/SELL), weightGram, pricePerGram, totalAmount, date, notes
- `Stock`: symbol, name, quantity, buyPrice, currentPrice, lastPriceUpdated, date, notes; has many dividends
- `Budget`: categoryName, amount, month (YYYY-MM), rolloverCap, canReduce
- `BankSaving`: type (DEPOSIT/WITHDRAWAL), accountName, amount, date, notes
- `Loan`: name, principal, remainingBalance, interestRate, monthlyPayment, startDate, notes
- `RecurringTransaction`: type, category, amount, description, frequency (WEEKLY/MONTHLY/YEARLY), startDate, endDate, nextDate, active, savingsGoalId
- `SavingsGoal`: name, targetAmount, savedAmount, targetDate, color
- `Dividend`: stockId, amount, date, notes
- `Category`: name, type, color, ruleType (NEED/WANT/SAVINGS)
- `MonthlyAnalysis`: month, summary (Markdown), totalIncome, totalExpenses, netSavings, savingsRate, topCategory, stockValue, goldValue, budgetCount, overBudgetCount, transactionCount, rawData
- `WidgetToken`: tokenHash (SHA-256), prefix, label, lastUsedAt
- `TrialRequest`: status (PENDING/APPROVED/DECLINED), message, decisionNote, decidedById, decidedAt
- `IdempotencyKey`: userId, key, method, path
- Auth tables: `Account`, `Session`, `VerificationToken` (NextAuth)

---

## Things to Improve / Known Gaps

### Product / UX
- **Empty states and onboarding:** some pages show basic empty states; a guided first-run flow (add first transaction, first gold deposit, first stock, first budget) would reduce time-to-value.
- **Currency / locale hardening:** IDR formatting is present, but number inputs are generic; consider locale-aware inputs and consistent prefix/suffix for currency fields across all forms.
- **Accessibility:** Radix primitives help, but some interactive cards/links mix button and link semantics; verify keyboard navigation, focus traps in dialogs, and ARIA labels on icon-only buttons.
- **Confirm dialogs:** some deletes use `window.confirm`; standardizing on Radix dialogs with clear undo would improve consistency.
- **Error messaging:** most errors surface via toast, but a few paths fall back to generic messages; enriching server error shapes and mapping them client-side would help.

### Data Integrity / Accounting
- **Double-entry / audit trail:** transactions are single-entry; a true double-entry ledger or at least an immutable audit log would strengthen correctness for gold sells, savings withdrawals, and loan payments.
- **Gold accounting on sell:** sells remove weight at average cost — verify edge cases (selling more than held, selling fractional grams, cost-basis drift after many buys/sells) are handled explicitly.
- **Stock lot/quantity semantics:** lots vs shares conversion is spread across dashboard, stocks page, and net-worth helper; centralizing the `SHARES_PER_LOT` contract and validation would reduce drift.
- **Idempotency:** implemented, but coverage should be verified across all mutating endpoints (transactions, budgets, gold, stocks, savings, recurring, goals, loans).

### Performance
- **Dashboard query breadth:** the dashboard OK endpoint fetches a very wide set of data and does in-memory aggregation; for large histories this is heavy. Consider covering indexes, materialized summaries, or read models for the hero KPIs.
- **All-time cash aggregation:** uses a `groupBy` capped at end of current budget month; confirm the "all-time" definition is what's intended and documented (it currently caps at end of current budget month, not truly all history).
- **Gold price timeout:** 500ms race is short; if the live price consistently times out, the dashboard falls back to cost basis every load — consider a slightly longer timeout or a cached last-known price.
- **Chart bundle size:** Recharts is loaded dynamically per chart; verify that dynamic imports are actually splitting chunks as intended and that the dashboard first paint stays fast on slow connections.

### Reliability / Ops
- **Cron reliability:** Vercel Cron is used for recurring transactions, price updates, and monthly analysis; these are critical paths and should have monitoring/alerting on failures and idempotency guarantees.
- **Rate limit fallback:** in-memory fallback is fine for dev but doesn't share state across instances; document that production rate limiting depends on Upstash Redis being configured.
- **AI analysis dependencies:** Groq API key, rate limits, and model availability affect a user-facing feature; the UI already surfaces Pro-only and rate-limit errors — add retry/backoff guidance and a cached last-good analysis where possible.
- **Price staleness:** stock/gold prices are cached in DB with `lastPriceUpdated`; surfaces should indicate staleness (e.g., "price from ... ago") so users don't misread live value.

### Security
- **Password policy:** `PASSWORD_MIN_LENGTH = 6` is very weak; raise the minimum and consider basic strength checks.
- **Session/JWT:** NextAuth v5 beta is in use; pin and watch for stable releases and security advisories.
- **Widget tokens:** stored hashed (good); confirm token entropy and rotation behavior, and that the `x-widget-token` header is validated consistently on every widget endpoint.
- **Admin bootstrap:** `ADMIN_EMAILS` auto-promotes first registrant; ensure this is only used for initial seed and not left active in production with broad email matching.

### Feature Gaps (commonly expected, not yet present)
- Bank account feeds / reconciliation (Plaid or Indonesian open banking)
- Multi-currency support
- Export to PDF/Excel beyond current CSV transaction export
- Push notifications / email alerts for budgets, price drops, recurring due dates
- Savings goals UI depth (progress visualization, contributions history) beyond data model
- OAuth sign-in (Google/GitHub)
- Mobile-native widget apps (the widget API exists; the companion native/Scriptable/KWGT apps are documented but not shipped in this repo)

---

## Non-Functional Requirements (as implemented)

- **Auth:** every dashboard API route requires a valid session; 401 otherwise
- **Validation:** Zod schemas on all public mutation inputs
- **Rate limits:** per-endpoint limits on transactions GET/POST, budgets POST, savings POST, gold POST; Upstash Redis with in-memory fallback
- **Cron auth:** cron endpoints verify `CRON_SECRET`
- **Security headers:** CSP and other headers configured in `next.config.ts`
- **Responsive:** sidebar collapses on mobile; grids reflow across breakpoints
- **Dark mode:** full light/dark/system theme support
- **Testing:** Vitest unit tests + Playwright E2E tests present in the repo

---

## API Surface (high level)

Authentication
- `POST /api/auth/register`
- `GET/POST /api/auth/[...nextauth]`

Core data
- `GET/POST /api/transactions`, `GET/PATCH/DELETE /api/transactions/[id]`
- `GET /api/transactions/export`, `POST /api/transactions/import`
- `GET/POST /api/gold`, `GET/PATCH/DELETE /api/gold/[id]`, `GET /api/gold/price`
- `GET/POST /api/stocks`, `GET/PATCH/DELETE /api/stocks/[id]`, `POST /api/stocks/update-prices`, `GET /api/stocks/search`
- `GET/POST /api/categories`, `GET/PATCH/DELETE /api/categories/[id]`
- `GET/POST /api/budgets`, `GET/PATCH/DELETE /api/budgets/[id]`, plus `/api/budgets/summary`, `/api/budgets/template`, `/api/budgets/ai-plan`, `/api/budgets/plan`, `/api/budgets/rollover-history`
- `GET/POST /api/savings`, `GET/PATCH/DELETE /api/savings/[id]`
- `GET/POST /api/loans`, `GET/PATCH/DELETE /api/loans/[id]`
- `GET/POST /api/goals`, `GET/PATCH /api/goals/[id]`, `/api/goals/ai-plan`
- `GET/POST /api/recurring-transactions`, `GET/PATCH/DELETE /api/recurring-transactions/[id]`
- `GET /api/reports`
- `GET /api/analysis`, `POST /api/analysis`
- `GET /api/dashboard`
- `GET /api/net-worth`
- `GET /api/user/budget-settings`, `PATCH /api/user/budget-settings`
- `GET /api/user/subscription`, `POST /api/user/trial-request`, `POST /api/user/password`, `GET /api/user/account`
- Widget: `GET /api/widget/data`, widget token CRUD under `/api/widget/tokens`
- Admin: `/api/admin/overview`, `/api/admin/users`, `/api/admin/users/[id]/route`, `/api/admin/users/[id]/reset-password`, `/api/admin/trial-requests`, `/api/admin/trial-requests/[id]`
- Cron: `/api/cron/apply-recurring`, `/api/cron/update-prices`, `/api/cron/monthly-analysis`
- Misc: `/api/health`, `/api/chat`

---

## Environment Variables (required to run)

- `DATABASE_URL` — PostgreSQL
- `AUTH_SECRET` — NextAuth signing secret
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — optional, enables distributed rate limiting
- `ADMIN_EMAILS` / `PRO_TRIAL_DAYS` — admin bootstrap + trial config
- `NEXT_PUBLIC_SITE_URL` — public URL for metadata + widget deep links
- `CRON_SECRET` — protects cron endpoints
- `GROQ_API_KEY` — AI analysis

---

## Notes / Assumptions

- This PRD reflects the **current codebase** as of the analyzed commit; it is not a forward-looking spec beyond the "Things to improve" section.
- The project targets Indonesian users (IDR, gold, IDX stocks), but the data model and UI are general enough to extend.
- Some features (dividends, goals, recurring, admin, widget API) are partially implemented and may have incomplete UI or docs; verify each before relying on it in production.
- The existing `PRD-GrandWealth.md` in the repo is an earlier draft; this document supersedes it with details drawn directly from the implementation.

