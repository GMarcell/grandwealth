# GrandWealth — Personal Wealth Management

> Track your expenses, income, gold deposits, stock portfolio, and monthly budgets — all in one place.

GrandWealth is a full-stack personal finance dashboard built with **Next.js 16**, **React 19**, **Tailwind CSS 4**, and **PostgreSQL**. It provides a unified view of your financial life with interactive charts, budget tracking with rollover capabilities, and support for custom transaction categories.

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
- **Summary Stats** — Total gold weight (g), total invested (IDR), and average price per gram
- **Transaction History** — Chronological list of all gold transactions with type badges

### 📈 Stocks
- **Portfolio Tracking** — Add stocks with symbol, company name, quantity, and buy price
- **Summary Stats** — Total number of distinct stocks, total shares, and total invested value
- **Search** — Filter portfolio by symbol or company name
- **Cost Basis** — Shows total cost per holding and per-share price

### 🐷 Budgets
- **Monthly Budgets** — Set spending limits per expense category for any month (up to 12 months back)
- **Rollover** — Unused budget can roll over to the next month (configurable per category)
- **Rollover Cap** — Optional maximum cap on how much unused budget carries forward
- **Effective Amount** — Original budget + rollover = effective spending limit
- **Progress Bars** — Visual indicators showing spent vs effective budget with color coding (green = under 80%, amber = 80-100%, red = over)
- **Over-budget & Near-limit badges** — Categories that exceed or approach their limits are highlighted
- **Budget Allocation Pie Chart** — Visual breakdown of how your total budget is distributed
- **Rollover History Table** — Month-over-month view showing rollover amounts, unused totals, and toggle/cap status per category
- **Month Selector** — View/edit budgets for any of the last 12 months

### ⚙️ Settings
- **Account Info** — Displays user name and email from the session
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

---

## 🏗️ Project Structure

```
grandwealth/
├── prisma/
│   └── schema.prisma           # Database schema (User, Transaction, GoldDeposit, Stock, Category, Budget, etc.)
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
│   │   │   ├── gold/page.tsx           # Gold deposit tracking (buy/sell)
│   │   │   ├── stocks/page.tsx         # Stock portfolio tracking
│   │   │   └── settings/page.tsx       # Account info, theme, custom categories
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts   # NextAuth handler
│   │       │   └── register/route.ts        # User registration
│   │       ├── dashboard/route.ts           # Aggregated dashboard data
│   │       ├── transactions/
│   │       │   ├── route.ts                 # GET (list), POST (create)
│   │       │   └── [id]/route.ts            # PATCH (update), DELETE
│   │       ├── gold/
│   │       │   ├── route.ts                 # GET (list), POST (create)
│   │       │   └── [id]/route.ts            # PATCH (update), DELETE
│   │       ├── stocks/
│   │       │   ├── route.ts                 # GET (list), POST (create)
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
│   │       ├── input.tsx               # Text input
│   │       ├── label.tsx               # Form label
│   │       ├── select.tsx              # Select dropdown
│   │       ├── skeleton.tsx            # Skeleton loading placeholder
│   │       └── switch.tsx              # Toggle switch
│   └── lib/
│       ├── auth.ts                     # NextAuth configuration (Credentials + PrismaAdapter)
│       ├── auth.config.ts              # Shared auth config (pages, callbacks, JWT strategy)
│       ├── prisma.ts                   # Prisma client singleton (with pg adapter, connection pooling)
│       ├── providers.tsx               # Client-side providers (Session, QueryClient, Theme, Toaster)
│       └── utils.ts                    # Helpers: cn(), formatIDR(), formatCompactIDR(), formatDate(), etc.
├── middleware.ts                       # Auth middleware — protects dashboard routes
├── next.config.ts                      # Next.js configuration
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

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates tables)
npm run prisma:migrate

# (Optional) Open Prisma Studio to inspect data
npm run prisma:studio
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Register a new account to get started.

### Available Scripts

| Script               | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the Next.js dev server             |
| `npm run build`      | Build for production (`prisma generate` + `next build`) |
| `npm run start`      | Start the production server              |
| `npm run lint`       | Run ESLint                               |
| `npm run prisma:generate` | Generate Prisma client              |
| `npm run prisma:migrate`  | Run database migrations            |
| `npm run prisma:studio`   | Open Prisma Studio GUI            |
| `npm run prisma:seed`     | Run the seed script              |

---

## 🗄️ Database Schema

The database uses **PostgreSQL** with **Prisma ORM**. Key models:

| Model               | Description                                      |
| ------------------- | ------------------------------------------------ |
| **User**            | User accounts with email/password auth            |
| **Account**         | NextAuth account linking (for future OAuth)       |
| **Session**         | NextAuth sessions (JWT strategy currently used)   |
| **VerificationToken** | NextAuth verification tokens                  |
| **Transaction**     | Income/expense records (type, category, amount, description, date) |
| **Category**        | Custom user-defined categories with name, type, and color |
| **Budget**          | Monthly spending limits per category (with rollover toggle + cap) |
| **GoldDeposit**     | Gold buy/sell records (weight, price, total)      |
| **Stock**           | Stock portfolio entries (symbol, name, quantity, buy price) |

See [prisma/schema.prisma](./prisma/schema.prisma) for the full schema with field details, constraints, and relations.

---

## 🔌 API Routes

All API routes are prefixed under `/api/`. All endpoints (except auth) require authentication — they validate the session via `auth()` and return `401` if unauthorized.

| Route                          | Method   | Description                                   |
| ------------------------------ | -------- | --------------------------------------------- |
| **Auth**                       |          |                                               |
| `/api/auth/register`           | `POST`   | Register a new user (email, name, password)    |
| `/api/auth/[...nextauth]`      | `GET/POST` | NextAuth handler (login, session, signout) |
|                               |          |                                               |
| **Dashboard**                  |          |                                               |
| `/api/dashboard`               | `GET`    | Aggregated wealth overview, stats, charts     |
|                               |          |                                               |
| **Transactions**               |          |                                               |
| `/api/transactions`            | `GET`    | List all transactions (descending by date)    |
| `/api/transactions`            | `POST`   | Create a transaction                          |
| `/api/transactions/[id]`       | `PATCH`  | Update a transaction                          |
| `/api/transactions/[id]`       | `DELETE` | Delete a transaction                          |
|                               |          |                                               |
| **Gold**                       |          |                                               |
| `/api/gold`                    | `GET`    | List all gold deposits                        |
| `/api/gold`                    | `POST`   | Record a gold buy/sell                        |
| `/api/gold/[id]`               | `PATCH`  | Update a gold record                          |
| `/api/gold/[id]`               | `DELETE` | Delete a gold record                          |
|                               |          |                                               |
| **Stocks**                     |          |                                               |
| `/api/stocks`                  | `GET`    | List all stock holdings                       |
| `/api/stocks`                  | `POST`   | Add a stock                                   |
| `/api/stocks/[id]`             | `PATCH`  | Update a stock                                |
| `/api/stocks/[id]`             | `DELETE` | Delete a stock                                |
|                               |          |                                               |
| **Categories**                 |          |                                               |
| `/api/categories`              | `GET`    | List custom categories                        |
| `/api/categories`              | `POST`   | Create a custom category                      |
| `/api/categories/[id]`         | `PATCH`  | Update a category                             |
| `/api/categories/[id]`         | `DELETE` | Delete a category                             |
|                               |          |                                               |
| **Budgets**                    |          |                                               |
| `/api/budgets`                 | `GET`    | List all budgets                              |
| `/api/budgets`                 | `POST`   | Create or update a budget (upsert)            |
| `/api/budgets/[id]`            | `PATCH`  | Update a budget                               |
| `/api/budgets/[id]`            | `DELETE` | Delete a budget                               |
| `/api/budgets/rollover-history` | `GET`   | Month-over-month rollover data per category   |

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
| `/gold`           | Gold deposit tracking                         | Yes           |
| `/stocks`         | Stock portfolio management                    | Yes           |
| `/budgets`        | Budget management with rollover               | Yes           |
| `/settings`       | Account info, theme, custom categories        | Yes           |

---

## 🎨 Theming

GrandWealth supports **light**, **dark**, and **system** themes via `next-themes`. The theme is persisted in local storage and toggled from the sidebar user menu (DropdownMenu) or the Settings page.

CSS custom properties for colors are defined in `src/app/globals.css` using the `oklch()` color space. All components reference these variables via Tailwind's `@theme inline` directive, ensuring seamless theme switching.

---

## 🧩 Key Architecture Decisions

- **Server-side data** fetched via **React Query** (`@tanstack/react-query`) with a 30s stale time, auto-refetch on the dashboard every 60s, and sidebar budget badge refresh every 120s
- **Currency formatting** is in **Indonesian Rupiah (IDR)** using `Intl.NumberFormat` with compact variants (e.g., `Rp1,5jt`, `Rp2,5M`)
- **Budget rollover** calculation: unused = max(0, effectiveAmount - spent). If `rolloverEnabled`, the unused carries to the next month; if a `rolloverCap` is set, the rollover is capped at that value
- **Category system** merges predefined categories (hardcoded) with user-created custom categories. Both are available in the transaction form based on the selected type (INCOME/EXPENSE)
- **Mobile responsiveness**: The sidebar collapses off-screen on mobile with a backdrop overlay. The main content area uses `lg:ml-64` offset on desktop

---

## 🚢 Deployment

1. Set the environment variables on your hosting platform (Vercel, Railway, Fly.io, etc.)
2. Point `DATABASE_URL` to your production PostgreSQL instance
3. Run migrations: `npx prisma migrate deploy`
4. Build & deploy: `npm run build && npm run start`

For **Vercel** specifically, the build command `npm run build` already includes `prisma generate`. Ensure the Prisma client binary targets match your deployment environment.

---

## 📝 License

This is a private/internal project. All rights reserved.
