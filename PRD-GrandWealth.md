# GrandWealth — Product Requirements Document (PRD)

> **Version:** 1.0  
> **Status:** Draft  
> **Date:** July 23, 2026  
> **Project:** GrandWealth — Personal Wealth Management Platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Personas](#3-user-personas)
4. [Feature Specifications](#4-feature-specifications)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Architecture](#6-technical-architecture)
7. [API Endpoints](#7-api-endpoints)
8. [Database Schema](#8-database-schema)
9. [UI/UX Design](#9-uiux-design)
10. [Security & Compliance](#10-security--compliance)
11. [Future Roadmap](#11-future-roadmap)
12. [Screenshots](#12-screenshots)

---

## 1. Executive Summary

**GrandWealth** is a full-stack personal finance dashboard built with **Next.js 16**, **React 19**, **Tailwind CSS 4**, and **PostgreSQL**. It provides a unified view of an individual's financial life, including income/expense tracking, gold investment management, stock portfolio tracking, monthly budgeting with rollover capabilities, and AI-powered monthly financial analysis.

The application is designed for individuals in Indonesia who want a comprehensive, modern, and visually appealing tool to manage their personal finances — tracking cash flow, investments in gold and stocks, and maintaining monthly budgets — all in Indonesian Rupiah (IDR).

**Target Market:** Indonesian individual investors and savers  
**Monetization Strategy:** Currently free/private, future potential for SaaS subscriptions  
**Business Goals:** Provide a single-pane-of-glass financial management experience replacing spreadsheets and fragmented apps

---

## 2. Product Overview

### 2.1 Problem Statement

Most personal finance tools in Indonesia are either:
- Fragmented (separate apps for budgeting, stock tracking, gold tracking)
- Too simplistic (lack investment tracking)
- Too complex (enterprise-grade, overwhelming for individuals)
- Not localized (foreign tools not optimized for IDR, IDX stocks, gold investments)

### 2.2 Solution

GrandWealth solves this by offering an all-in-one personal wealth management platform that combines:

- **Cash flow management** (income/expense tracking)
- **Investment tracking** (Stocks on IDX, Gold investments)
- **Budgeting** (with rollover and custom budget cycles)
- **Bank savings tracking**
- **Recurring transaction management**
- **Financial reporting & analysis** (including AI-powered monthly insights)
- **Live market prices** (via Yahoo Finance integration)

### 2.3 Key Differentiators

1. **Unified Dashboard** — Net wealth calculation combining cash, gold, and stocks in one view
2. **Live Market Data** — Real-time gold and stock prices via Yahoo Finance
3. **Budget Rollover** — Unused budget carries forward month-to-month with configurable caps
4. **Custom Budget Cycle** — Configurable start day (1-28) for personalized budget periods
5. **AI Monthly Analysis** — Groq-powered monthly financial reports with insights
6. **50/30/20 Rule Support** — Category classification (Needs/Wants/Savings) for budget analysis
7. **Indonesian Market Focus** — IDX stock support, IDR currency, gold investment tracking
8. **Dark/Light/System Theme** — Full theme support for comfortable viewing

### 2.4 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │   Auth     │  │  Pages    │  │  API Routes│  │Middleware│ │
│  │ (NextAuth) │  │ (RSC/RCC) │  │  (REST)   │  │(Auth GW) │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └──────────┘ │
│        │              │              │                       │
├────────┴──────────────┴──────────────┴───────────────────────┤
│                    Client Libraries                           │
│  React Query (Data) | Recharts (Charts) | Radix UI (Widgets)  │
│  React Hook Form + Zod (Forms) | Sonner (Toasts)             │
│  next-themes (Theme) | Lucide (Icons)                        │
├───────────────────────────────────────────────────────────────┤
│                    Server Layer                                │
│  NextAuth v5 (Credentials/JWT) | Prisma ORM | Yahoo Finance2  │
│  Groq SDK (AI Analysis) | bcryptjs (Password) | date-fns      │
├───────────────────────────────────────────────────────────────┤
│                    Database                                    │
│  PostgreSQL (via Neon) | Prisma Migrations                    │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. User Personas

### 3.1 Primary Persona: The Indonesian Professional

- **Name:** Budi
- **Age:** 28-40
- **Occupation:** Salaried professional / small business owner
- **Financial Activities:**
  - Has monthly salary income
  - Tracks daily expenses
  - Invests in gold (traditional Indonesian investment)
  - Buys stocks on Indonesia Stock Exchange (IDX)
  - Wants to budget and save
- **Pain Points:**
  - Uses spreadsheets but finds them cumbersome
  - Has multiple accounts across banks and brokerages
  - No unified view of total wealth
  - Struggles with budget discipline
- **Goals:**
  - See total net worth at a glance
  - Track gold and stock investments alongside cash
  - Stay within monthly budgets
  - Get automated financial insights

### 3.2 Secondary Persona: The Budget-Conscious Saver

- **Name:** Sari
- **Age:** 22-30
- **Occupation:** Recent graduate / early career
- **Financial Activities:**
  - Strict monthly budgeting
  - Saving for goals (emergency fund, vacation, down payment)
  - Occasional freelance income
- **Pain Points:**
  - Overspending on specific categories
  - Forgets recurring bills
  - Needs visual motivation to save
- **Goals:**
  - Clear budget progress indicators
  - Rollover budgeting to save unused amounts
  - Track savings account growth
  - See spending patterns through charts

---

## 4. Feature Specifications

### 4.1 Authentication & User Management

| Feature | Priority | Description |
|---------|----------|-------------|
| Email/Password Registration | P0 | Register with name, email, password |
| Email/Password Login | P0 | Login with credentials via NextAuth |
| JWT Session Management | P0 | Stateless sessions with JWT tokens |
| Protected Routes | P0 | Middleware guarding all dashboard routes |
| Budget Cycle Setting | P1 | Configurable budget month start day (1-28) |

### 4.2 Dashboard (Overview)

| Feature | Priority | Description |
|---------|----------|-------------|
| Total Net Wealth | P0 | Combined view of cash, gold, and stocks in IDR |
| Income & Expenses Summary | P0 | Monthly income/expense with surplus/deficit badge |
| Gold & Stocks Snapshot | P0 | Total gold weight/value, stock count |
| Monthly Cash Flow Chart | P0 | Line chart showing income vs expenses over time (Recharts) |
| Wealth Breakdown Pie Chart | P0 | Donut chart for cash/gold/stocks allocation |
| Budget Summary Card | P0 | Overall budget progress with alerts |
| Recent Transactions | P0 | Last 5 transactions displayed inline |
| Quick Actions | P1 | One-click links to add data |
| Auto-refresh (60s) | P1 | Dashboard auto-refreshes every 60 seconds |

### 4.3 Transactions (CRUD)

| Feature | Priority | Description |
|---------|----------|-------------|
| Create Transaction | P0 | Add income/expense with type, category, amount, description, date |
| Read Transactions | P0 | Paginated list (50/page), descending by date |
| Update Transaction | P0 | Edit any transaction field |
| Delete Transaction | P0 | Remove transaction with confirmation |
| Type Toggle | P0 | Switch between INCOME and EXPENSE |
| Dynamic Categories | P0 | Predefined + custom user categories |
| Search | P0 | Search by description with 300ms debounce |
| Type Filter | P0 | Filter by All/Income/Expense |
| Budget Alerts | P1 | Toast notifications when near/over budget |
| CSV Export | P2 | Export transactions as CSV |
| CSV Import | P2 | Import transactions from CSV |

### 4.4 Gold Investment Tracking

| Feature | Priority | Description |
|---------|----------|-------------|
| Buy/Sell Recording | P0 | Record gold purchases and sales |
| Weight & Price | P0 | Track weight in grams and price per gram |
| Total Calculation | P0 | Auto-calculate total amount |
| Live Market Price | P0 | Fetch real-time gold price from Yahoo Finance |
| Portfolio Value & P&L | P0 | Market value and unrealized profit/loss |
| Summary Stats | P1 | Total weight, total invested, avg price, current price |
| Transaction History | P0 | Chronological list with type badges |
| Price Auto-refresh | P1 | Auto-refresh gold price every 5 minutes |

### 4.5 Stock Portfolio Tracking

| Feature | Priority | Description |
|---------|----------|-------------|
| Add Stock | P0 | Symbol, company name, quantity, buy price |
| Update Stock | P0 | Edit stock holdings |
| Delete Stock | P0 | Remove from portfolio |
| Live Prices | P0 | Fetch current prices from Yahoo Finance (IDX support) |
| Market Value & P&L | P0 | Total value, unrealized P&L, percentage change |
| Refresh Prices | P1 | One-click update all stock prices |
| Price Persistence | P1 | Store current prices in database |
| Auto-Update via Cron | P2 | Scheduled price updates (market open/close) |
| Summary Stats | P1 | Total stocks, shares, invested, market value |
| Search | P1 | Filter by symbol or company name |

### 4.6 Budget Management

| Feature | Priority | Description |
|---------|----------|-------------|
| Monthly Budgets | P0 | Set spending limits per expense category |
| Custom Budget Cycle | P0 | Configurable start day (1-28) |
| Rollover | P0 | Unused budget carries to next month |
| Rollover Cap | P1 | Maximum cap on rollover amount |
| Effective Amount | P0 | Original budget + rollover = spending limit |
| Progress Bars | P0 | Visual indicators with color coding (green/amber/red) |
| Over-budget & Near-limit | P0 | Badge alerts for exceeded/approaching budgets |
| Budget Allocation Chart | P1 | Pie chart showing budget distribution |
| Rollover History | P1 | Month-over-month rollover data table |
| Month Selector | P0 | View/edit budgets for any of last 12 months |

### 4.7 Bank Savings Tracking

| Feature | Priority | Description |
|---------|----------|-------------|
| Deposit/Withdrawal Recording | P0 | Track savings account activity |
| Account Name | P0 | Support multiple savings accounts |
| Amount & Date | P0 | Record amounts with dates |
| Notes | P1 | Optional notes per entry |
| Summary Stats | P1 | Total saved across accounts |
| Transaction History | P0 | Chronological list with type badges |

### 4.8 Recurring Transactions

| Feature | Priority | Description |
|---------|----------|-------------|
| Create Recurring | P0 | Set up weekly/monthly/yearly transactions |
| Frequency Types | P0 | WEEKLY, MONTHLY, YEARLY |
| Active/Inactive Toggle | P1 | Enable/disable recurring transactions |
| Start/End Dates | P1 | Optional end date for recurring items |
| Next Date Tracking | P1 | Track when next occurrence is due |

### 4.9 Financial Reports

| Feature | Priority | Description |
|---------|----------|-------------|
| Monthly Bar Chart | P0 | Income vs expenses by month |
| Category Pie Chart | P0 | Spending breakdown by category |
| Date Range Filter | P1 | Custom date range selection |
| Summary Stats | P0 | Total income, expenses, savings for period |

### 4.10 AI Monthly Analysis

| Feature | Priority | Description |
|---------|----------|-------------|
| Groq AI Integration | P1 | AI-generated monthly financial analysis |
| 50/30/20 Rule Analysis | P1 | Needs/Wants/Savings breakdown |
| Monthly Summary | P1 | Generated Markdown analysis text |
| Key Metrics | P1 | Income, expenses, savings rate, top categories |
| Historical Comparison | P2 | Compare with previous months |

### 4.11 Settings

| Feature | Priority | Description |
|---------|----------|-------------|
| Account Info | P0 | Display user name and email |
| Budget Cycle | P1 | Configure budget start day (1-28) |
| Theme Toggle | P0 | Light/Dark/System mode |
| Custom Categories | P0 | Create, view, delete custom categories |
| Color Picker | P1 | Assign colors to custom categories |
| 50/30/20 Rule Type | P1 | Classify categories as Need/Want/Savings |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target |
|-------------|--------|
| Page Load (initial) | < 3 seconds to interactive |
| Page Load (subsequent) | < 1 second (React Query caching) |
| API Response Time | < 500ms for CRUD operations |
| Chart Rendering | < 200ms |
| Search Response | < 1 second (debounced 300ms) |
| Price Refresh (Gold) | < 3 seconds |
| Price Refresh (Stocks, batch) | < 5 seconds for 10+ symbols |

### 5.2 Scalability

| Requirement | Target |
|-------------|--------|
| Concurrent Users | 100+ (single PostgreSQL instance) |
| Transaction Storage | 100,000+ transactions per user (indexed) |
| Budget Months | Unlimited (stored as YYYY-MM keys) |
| Stock Symbols | Unlimited per user |

### 5.3 Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | NextAuth v5 with Credentials provider |
| Password Hashing | bcryptjs (12 salt rounds) |
| Session Management | JWT strategy (stateless) |
| API Authorization | Session validation on every request (401 if unauthorized) |
| HTTP Security Headers | CSP, X-Frame-Options, X-Content-Type-Options, etc. |
| Input Validation | Zod schemas on all API inputs |
| Cron Security | CRON_SECRET header validation |
| Database Security | Parameterized queries via Prisma |

### 5.4 Availability

| Requirement | Target |
|-------------|--------|
| Uptime | 99.9% (hosted on Vercel) |
| Data Backup | PostgreSQL automatic backups (Neon) |
| Error Recovery | Graceful error boundaries on all pages |
| Loading States | Skeleton loading on all data-dependent components |

### 5.5 Browser Support

| Browser | Support |
|---------|---------|
| Chrome (latest 2 versions) | Full |
| Firefox (latest 2 versions) | Full |
| Safari (latest 2 versions) | Full |
| Edge (latest 2 versions) | Full |
| Mobile Chrome/Safari | Responsive design, collapsible sidebar |

---

## 6. Technical Architecture

### 6.1 Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | Next.js (App Router) | 16.2.9 |
| **Language** | TypeScript | ^5 |
| **UI Library** | React | 19.2.4 |
| **Styling** | Tailwind CSS | ^4 |
| **Animations** | tw-animate-css | ^1.4.0 |
| **Icons** | Lucide React | ^1.18.0 |
| **Charts** | Recharts | ^3.8.1 |
| **Auth** | NextAuth.js | v5 beta 31 |
| **Database** | PostgreSQL (Neon) | N/A |
| **ORM** | Prisma | ^5.22.0 |
| **Forms** | React Hook Form | ^7.78.0 |
| **Validation** | Zod | ^4.4.3 |
| **State Mgmt** | TanStack React Query | ^5.101.0 |
| **Theme** | next-themes | ^0.4.6 |
| **Toasts** | sonner | ^2.0.7 |
| **Password** | bcryptjs | ^3.0.3 |
| **Dates** | date-fns | ^4.4.0 |
| **Market Data** | yahoo-finance2 | ^3.15.3 |
| **AI** | Groq SDK | ^1.3.0 |
| **Testing** | Vitest + Playwright | Latest |

### 6.2 Project Structure

```
grandwealth/
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Migration files
│   └── seed.ts                 # Seed script
├── src/
│   ├── app/
│   │   ├── globals.css         # Tailwind + CSS variables
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Root → redirect to /dashboard
│   │   ├── login/             # Login page
│   │   ├── register/          # Registration page
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── transactions/  # Transaction management
│   │   │   ├── budgets/       # Budget management
│   │   │   ├── gold/          # Gold tracking
│   │   │   ├── stocks/        # Stock portfolio
│   │   │   ├── savings/       # Bank savings
│   │   │   ├── reports/       # Financial reports
│   │   │   ├── analysis/      # AI analysis
│   │   │   ├── recurring/     # Recurring transactions
│   │   │   ├── settings/      # User settings
│   │   │   └── layout.tsx     # Dashboard shell
│   │   └── api/               # REST API routes
│   ├── components/
│   │   ├── auth/              # Auth forms
│   │   ├── layout/            # Sidebar, dashboard layout
│   │   ├── charts/            # Recharts components
│   │   └── ui/                # Radix UI components
│   └── lib/
│       ├── auth.ts            # NextAuth config
│       ├── prices.ts          # Yahoo Finance service
│       ├── budget-months.ts   # Budget month helpers
│       ├── utils.ts           # Utility functions
│       └── validation.ts      # Zod schemas
├── e2e/                       # Playwright E2E tests
├── middleware.ts              # Auth middleware
├── next.config.ts             # Next.js config
└── vercel.json                # Vercel + cron config
```

### 6.3 Data Flow Architecture

```
User Browser
     │
     ▼
Next.js Server (RSC + API Routes)
     │
     ├── Server Components → Direct DB queries (Prisma)
     ├── Client Components → React Query → API Routes → Prisma → PostgreSQL
     │
     ├── Market Data → API Routes → Yahoo Finance2 → External APIs
     │
     └── AI Analysis → API Routes → Groq SDK → Groq API
```

### 6.4 Key Design Decisions

1. **Server Components for static content** — Headers, page shells rendered on server
2. **Client Components for interactive data** — React Query for data fetching with caching
3. **Route Groups** — `(dashboard)` group for protected pages with shared layout
4. **Pagination** — Server-side pagination via API query params (page, pageSize)
5. **Debounced Search** — 300ms debounce on client, server-side filtering
6. **Optimistic Updates** — Not currently implemented; standard mutation/invalidation pattern
7. **Cron Jobs** — Vercel Cron Jobs for scheduled stock price updates

---

## 7. API Endpoints

### 7.1 Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handler (login, session) | Varies |

### 7.2 Dashboard
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/dashboard` | Aggregated wealth overview | Yes |

### 7.3 Transactions
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/transactions` | List (paginated, searchable, filterable) | Yes |
| POST | `/api/transactions` | Create | Yes |
| PATCH | `/api/transactions/[id]` | Update | Yes |
| DELETE | `/api/transactions/[id]` | Delete | Yes |
| GET | `/api/transactions/export` | CSV export | Yes |
| POST | `/api/transactions/import` | CSV import | Yes |

### 7.4 Gold
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/gold` | List deposits | Yes |
| POST | `/api/gold` | Create deposit | Yes |
| PATCH | `/api/gold/[id]` | Update | Yes |
| DELETE | `/api/gold/[id]` | Delete | Yes |
| GET | `/api/gold/price` | Live gold price | Yes |

### 7.5 Stocks
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/stocks` | List holdings | Yes |
| POST | `/api/stocks` | Add stock | Yes |
| PATCH | `/api/stocks/[id]` | Update | Yes |
| DELETE | `/api/stocks/[id]` | Delete | Yes |
| POST | `/api/stocks/update-prices` | Refresh prices | Yes |

### 7.6 Categories
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/categories` | List custom categories | Yes |
| POST | `/api/categories` | Create custom category | Yes |
| PATCH | `/api/categories/[id]` | Update | Yes |
| DELETE | `/api/categories/[id]` | Delete | Yes |

### 7.7 Budgets
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/budgets` | List budgets | Yes |
| POST | `/api/budgets` | Create/update (upsert) | Yes |
| PATCH | `/api/budgets/[id]` | Update | Yes |
| DELETE | `/api/budgets/[id]` | Delete | Yes |
| GET | `/api/budgets/rollover-history` | Rollover data | Yes |

### 7.8 User Settings
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/user/budget-settings` | Get budget start day | Yes |
| PATCH | `/api/user/budget-settings` | Update budget start day | Yes |

### 7.9 Cron Jobs
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/cron/update-prices` | Update stock prices (all users) | CRON_SECRET |

---

## 8. Database Schema

### 8.1 Entity Relationship Diagram (Text)

```
User (1) ──── (N) Transaction
User (1) ──── (N) Category
User (1) ──── (N) Budget
User (1) ──── (N) GoldDeposit
User (1) ──── (N) Stock
User (1) ──── (N) BankSaving
User (1) ──── (N) RecurringTransaction
User (1) ──── (N) MonthlyAnalysis
User (1) ──── (N) Account (NextAuth)
User (1) ──── (N) Session (NextAuth)
```

### 8.2 Core Models

**User**
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String? | Display name |
| email | String (unique) | Login identifier |
| password | String? | bcrypt hashed |
| budgetStartDay | Int (default: 1) | 1-28 |

**Transaction**
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| type | Enum (INCOME/EXPENSE) | |
| category | String | Predefined or custom |
| amount | Float | In IDR |
| description | String | User-provided |
| date | DateTime | Transaction date |
| userId | String | FK → User |

**GoldDeposit**
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| type | Enum (BUY/SELL) | |
| weightGram | Float | Gold weight |
| pricePerGram | Float | Price per gram |
| totalAmount | Float | weightGram × pricePerGram |
| date | DateTime | |
| notes | String? | Optional |
| userId | String | FK → User |

**Stock**
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| symbol | String | e.g., BBCA, ANTM |
| name | String | Company name |
| quantity | Int | Number of shares |
| buyPrice | Float | Purchase price per share |
| currentPrice | Float? | Latest market price (cached) |
| lastPriceUpdated | DateTime? | When price was last fetched |
| date | DateTime | Purchase date |
| notes | String? | Optional |
| userId | String | FK → User |

**Budget**
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| categoryName | String | Expense category |
| amount | Float | Budget limit |
| month | String | Format: "YYYY-MM" |
| rolloverEnabled | Boolean (default: true) | |
| rolloverCap | Float? | Maximum rollover |
| userId | String | FK → User |

**MonthlyAnalysis**
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| month | String | "YYYY-MM" |
| summary | String | AI-generated Markdown |
| totalIncome | Float | |
| totalExpenses | Float | |
| netSavings | Float | |
| savingsRate | Float | Percentage |
| topCategory | String? | Top spending category |
| stockValue | Float? | End-of-month portfolio value |
| goldValue | Float? | End-of-month gold value |
| rawData | String | JSON snapshot of underlying data |
| userId | String | FK → User |

**Category**
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String | Category name |
| type | String | "INCOME" or "EXPENSE" |
| color | String (default: "#6366f1") | Hex color |
| ruleType | Enum? | NEED/WANT/SAVINGS |
| userId | String | FK → User |

---

## 9. UI/UX Design

### 9.1 Design System

- **Color Palette:** oklch() color space, CSS custom properties
- **Typography:** Geist Sans (headings/body) + Geist Mono (code/numbers)
- **Spacing:** Tailwind spacing scale
- **Border Radius:** Consistent rounded-lg for cards, rounded-full for badges
- **Shadows:** Subtle shadow for cards, none for flat design elements

### 9.2 Layout

```
┌─────────────────────────────────────────────┐
│  Sidebar (lg: 256px, collapsed on mobile)    │
│  ┌───────┐─────────────────────────────────┐│
│  │ User   │ Main Content Area               ││
│  │ Menu   │                                 ││
│  │        │  ┌───────────────────────────┐  ││
│  │ Nav    │  │  Page Header              │  ││
│  │ Items  │  ├───────────────────────────┤  ││
│  │        │  │  Content                  │  ││
│  │  • Dash │  │  • Cards                 │  ││
│  │  • Trans│  │  • Charts                │  ││
│  │  • Gold │  │  • Tables                │  ││
│  │  • Stocks│  │  • Forms (Dialogs)      │  ││
│  │  • Budget│  └───────────────────────────┘  ││
│  │  • etc  │                                 ││
│  └─────────┴─────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 9.3 Navigation Structure

| Nav Item | Icon | Route |
|----------|------|-------|
| Dashboard | LayoutDashboard | /dashboard |
| Transactions | ArrowLeftRight | /transactions |
| Gold | CircleDollarSign | /gold |
| Stocks | TrendingUp | /stocks |
| Budgets | PiggyBank | /budgets |
| Savings | Wallet | /savings |
| Reports | BarChart3 | /reports |
| Analysis | Sparkles | /analysis |
| Recurring | Repeat | /recurring |
| Settings | Settings | /settings |

### 9.4 Component States

Every data-driven component supports these states:
- **Loading:** Skeleton placeholders matching final layout
- **Empty:** Informational message with CTA to add data
- **Error:** Error boundary with retry option
- **Success:** Data displayed with appropriate formatting
- **Optimistic:** (Future) Instant UI updates before API confirmation

### 9.5 Responsive Breakpoints

| Breakpoint | Target | Layout |
|------------|--------|--------|
| < 768px | Mobile | Hamburger menu, stacked cards, full-width |
| 768-1024px | Tablet | Collapsed sidebar, 2-column grid |
| 1024px+ | Desktop | Expanded sidebar, 3-column grid |

---

## 10. Security & Compliance

### 10.1 Authentication Security

- Passwords hashed with bcryptjs (12 rounds)
- JWT tokens encrypted with NEXTAUTH_SECRET
- Session tokens validated on every API request
- Rate limiting on auth endpoints (register/login)

### 10.2 Data Security

- HTTPS enforced (Vercel deployment)
- SQL injection protection via Prisma parameterized queries
- Input validation via Zod schemas on all API inputs
- CSRF protection via NextAuth
- XSS protection via React's built-in escaping

### 10.3 API Security

- All dashboard API routes validate session via `auth()` function
- 401 Unauthorized responses for invalid/missing sessions
- CRON secret required for automated price update endpoint
- CSP headers blocking inline scripts, frame embedding, etc.

### 10.4 Data Privacy

- User data isolated by userId (no cross-user data access)
- No sensitive data in client-side bundles
- Database credentials stored as environment variables
- API keys (Yahoo Finance, Groq) server-side only

---

## 11. Future Roadmap

### Phase 2 (Short-term)
- [ ] **Bank Account Reconciliation** — Link bank accounts via Plaid/connect
- [ ] **Goal Tracking** — Set savings goals with progress tracking
- [ ] **Multi-currency Support** — Track expenses in different currencies
- [ ] **Expense Splitting** — Split transactions across categories
- [ ] **Budget Templates** — Pre-built budget templates (50/30/20, zero-based)
- [ ] **Push Notifications** — Budget alerts, price drops, bill reminders

### Phase 3 (Medium-term)
- [ ] **Investment Analytics** — Portfolio performance, risk metrics, dividend tracking
- [ ] **Tax Reporting** — Generate tax reports (PPh, capital gains)
- [ ] **Collaborative Budgeting** — Family/shared budgets
- [ ] **Mobile App** — React Native or PWA with offline support
- [ ] **Data Export** — PDF reports, Excel exports
- [ ] **OAuth Integration** — Google/GitHub sign-in

### Phase 4 (Long-term)
- [ ] **AI Financial Advisor** — Personalized recommendations based on spending patterns
- [ ] **Market Alerts** — Price targets, portfolio rebalancing notifications
- [ ] **Bill Pay Integration** — Automated bill payments
- [ ] **Open Banking** — Direct bank integration via Indonesian open banking APIs
- [ ] **Community Features** — Anonymous spending benchmarks, tips sharing

---

## 12. Screenshots

> *Note: Screenshots are to be captured from the running application. Below are descriptions of each page for the PRD review. When running the app locally, navigate to each page and capture full-page screenshots.*

### 12.1 Login Page (`/login`)
**Description:** Clean, centered login form with email and password fields. "Sign in to your account" heading with link to registration page. Brand name "GrandWealth" displayed prominently. Light/dark themed background.

**To capture:** Navigate to `http://localhost:3001/login`, take full-page screenshot.

### 12.2 Registration Page (`/register`)
**Description:** Registration form with name, email, and password fields. Links to login for existing users. Same aesthetic as login page.

**To capture:** Navigate to `http://localhost:3001/register`, take full-page screenshot.

### 12.3 Dashboard (`/dashboard`)
**Description:** Main wealth overview showing:
- **Top row:** Total Net Wealth card, Income/Expense summary, Gold snapshot, Stocks snapshot
- **Middle:** Monthly Cash Flow line chart (left), Wealth Breakdown pie chart (right)
- **Bottom:** Budget Summary card, Recent Transactions list, Quick Actions buttons

**To capture:** Log in, navigate to `/dashboard`, take full-page screenshot.

### 12.4 Transactions (`/transactions`)
**Description:** Transaction list page with:
- Search bar and type filter (All/Income/Expense)
- Paginated list of transactions with type badges, categories, amounts, and dates
- Add Transaction button opens dialog form
- Each row has edit/delete action buttons on hover

**To capture:** Navigate to `/transactions`, take full-page screenshot.

### 12.5 Gold (`/gold`)
**Description:** Gold investment page with:
- Summary cards: Total weight (g), Total invested, Avg price/gram, Current market price
- Portfolio value and P&L display
- Add Buy/Sell button opens dialog form
- Transaction history list with BUY/SELL badges

**To capture:** Navigate to `/gold`, take full-page screenshot.

### 12.6 Stocks (`/stocks`)
**Description:** Stock portfolio with:
- Summary cards: Total stocks, Total shares, Total invested, Market value
- Portfolio value and P&L with percentage change
- Refresh Prices button
- Holdings table: Symbol, Name, Quantity, Buy Price, Current Price, P&L
- Add Stock dialog

**To capture:** Navigate to `/stocks`, take full-page screenshot.

### 12.7 Budgets (`/budgets`)
**Description:** Budget management page with:
- Month selector (dropdown with last 12 months)
- Budget allocation pie chart
- Budget list with progress bars (green/amber/red)
- Rollover amounts and caps
- Over-budget and near-limit badges
- Rollover history table
- Add Budget dialog

**To capture:** Navigate to `/budgets`, take full-page screenshot.

### 12.8 Savings (`/savings`)
**Description:** Bank savings tracking page with:
- Total saved summary card
- Deposit/Withdrawal list with account names
- Add Deposit/Withdrawal dialog

**To capture:** Navigate to `/savings`, take full-page screenshot.

### 12.9 Reports (`/reports`)
**Description:** Financial reports page with:
- Monthly Bar Chart (income vs expenses)
- Category Pie Chart (spending breakdown)
- Date range filter
- Summary statistics

**To capture:** Navigate to `/reports`, take full-page screenshot.

### 12.10 Analysis (`/analysis`)
**Description:** AI-powered monthly analysis page with:
- Month selector
- AI-generated Markdown summary (from Groq)
- Key metrics: Income, Expenses, Savings Rate, Top Category
- 50/30/20 rule breakdown

**To capture:** Navigate to `/analysis`, take full-page screenshot.

### 12.11 Recurring (`/recurring`)
**Description:** Recurring transactions page with:
- List of recurring transactions with frequency badges
- Active/inactive toggle
- Add Recurring dialog with WEEKLY/MONTHLY/YEARLY options

**To capture:** Navigate to `/recurring`, take full-page screenshot.

### 12.12 Settings (`/settings`)
**Description:** User settings page with:
- Account Info card (name, email)
- Budget Cycle card (start day selector 1-28)
- Theme Toggle (Light/Dark/System)
- Custom Categories section with color pickers and rule types

**To capture:** Navigate to `/settings`, take full-page screenshot.

---

## Appendices

### A. Environment Variables

```env
DATABASE_URL="postgresql://..."           # PostgreSQL connection string
AUTH_SECRET="..."                          # JWT encryption key (openssl rand -hex 32)
NEXTAUTH_URL="http://localhost:3000"       # App URL
CRON_SECRET="..."                          # Secret for cron endpoint
GROQ_API_KEY="gsk_..."                     # Groq AI API key
```

### B. Predefined Categories

**Income:** SALARY, FREELANCE, BUSINESS, INVESTMENT, DIVIDEND, INTEREST, RENTAL, GIFT, REFUND, OTHER_INCOME

**Expense:** FOOD, TRANSPORTATION, HOUSING, UTILITIES, HEALTHCARE, EDUCATION, ENTERTAINMENT, SHOPPING, TRAVEL, INSURANCE, TAX, SUBSCRIPTION, OTHER_EXPENSE

### C. Package Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run lint` | Lint code (ESLint) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed sample data |

---

*Document prepared by Buffy AI | Freebuff*  
*Generated based on comprehensive codebase analysis of GrandWealth v0.1.0*
