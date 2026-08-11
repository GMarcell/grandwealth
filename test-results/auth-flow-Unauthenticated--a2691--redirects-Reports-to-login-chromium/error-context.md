# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Unauthenticated — Auth Flow >> Protected routes redirect >> redirects Reports to /login
- Location: e2e/tests/auth-flow.spec.ts:120:11

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:3000/reports"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e5]:
        - img [ref=e6]
        - generic [ref=e9]: GrandWealth
      - navigation [ref=e10]:
        - link "Dashboard" [ref=e11] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e12]
          - generic [ref=e17]: Dashboard
        - link "Transactions" [ref=e18] [cursor=pointer]:
          - /url: /transactions
          - img [ref=e19]
          - generic [ref=e22]: Transactions
        - link "Recurring" [ref=e23] [cursor=pointer]:
          - /url: /recurring
          - img [ref=e24]
          - generic [ref=e29]: Recurring
        - link "Reports" [ref=e30] [cursor=pointer]:
          - /url: /reports
          - img [ref=e31]
          - generic [ref=e33]: Reports
        - link "AI Analysis" [ref=e34] [cursor=pointer]:
          - /url: /analysis
          - img [ref=e35]
          - generic [ref=e43]: AI Analysis
        - link "Savings" [ref=e44] [cursor=pointer]:
          - /url: /savings
          - img [ref=e45]
          - generic [ref=e47]: Savings
        - link "Goals" [ref=e48] [cursor=pointer]:
          - /url: /goals
          - img [ref=e49]
          - generic [ref=e53]: Goals
        - link "Debts" [ref=e54] [cursor=pointer]:
          - /url: /debts
          - img [ref=e55]
          - generic [ref=e57]: Debts
        - link "Gold" [ref=e58] [cursor=pointer]:
          - /url: /gold
          - img [ref=e59]
          - generic [ref=e62]: Gold
        - link "Stocks" [ref=e63] [cursor=pointer]:
          - /url: /stocks
          - img [ref=e64]
          - generic [ref=e67]: Stocks
        - link "Budgets" [ref=e68] [cursor=pointer]:
          - /url: /budgets
          - img [ref=e69]
          - generic [ref=e72]: Budgets
        - link "Settings" [ref=e73] [cursor=pointer]:
          - /url: /settings
          - img [ref=e74]
          - generic [ref=e77]: Settings
      - generic [ref=e78]:
        - generic [ref=e79]:
          - generic [ref=e80]: E
          - generic [ref=e81]:
            - paragraph [ref=e82]: E2E Test User
            - paragraph [ref=e83]: e2e-budget-1785822541395@test.grandwealth.app
        - generic [ref=e84]:
          - button "Toggle theme" [ref=e85]:
            - img
            - generic [ref=e86]: Toggle theme
          - button "Sign out" [ref=e87]:
            - img
    - main [ref=e88]:
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]:
            - heading "Financial Reports" [level=1] [ref=e93]
            - paragraph [ref=e94]: Analyze your spending patterns and financial trends
          - generic [ref=e95]:
            - combobox [ref=e96]:
              - img [ref=e97]
              - generic: Last 12 months
              - img [ref=e99]
            - button "Refresh" [ref=e101]:
              - img
              - text: Refresh
            - button "Export" [ref=e102]:
              - img
              - text: Export
        - generic [ref=e103]:
          - generic [ref=e104]:
            - generic [ref=e105]:
              - heading "Total Income" [level=2] [ref=e106]
              - img [ref=e107]
            - generic [ref=e110]:
              - generic [ref=e111]: Rp0
              - paragraph [ref=e112]: Over 1 months
          - generic [ref=e113]:
            - generic [ref=e114]:
              - heading "Total Expenses" [level=2] [ref=e115]
              - img [ref=e116]
            - generic [ref=e119]:
              - generic [ref=e120]: Rp0
              - paragraph [ref=e121]: Over 1 months
          - generic [ref=e122]:
            - generic [ref=e123]:
              - heading "Net Cash Flow" [level=2] [ref=e124]
              - img [ref=e125]
            - generic [ref=e128]:
              - generic [ref=e129]: Rp0
              - generic [ref=e130]: Surplus
          - generic [ref=e131]:
            - generic [ref=e132]:
              - heading "Avg Monthly Net" [level=2] [ref=e133]
              - img [ref=e134]
            - generic [ref=e137]:
              - generic [ref=e138]: Rp0
              - paragraph [ref=e139]: Average per month
        - generic [ref=e140]:
          - heading "Monthly Income vs Expenses" [level=2] [ref=e142]:
            - img [ref=e143]
            - text: Monthly Income vs Expenses
          - generic [ref=e147]:
            - list [ref=e149]:
              - listitem [ref=e150]:
                - img "Expenses legend icon" [ref=e151]
                - text: Expenses
              - listitem [ref=e153]:
                - img "Income legend icon" [ref=e154]
                - text: Income
            - application [ref=e156]
        - generic [ref=e161]:
          - generic [ref=e162]:
            - heading "Expenses by Category" [level=2] [ref=e164]:
              - img [ref=e165]
              - text: Expenses by Category
            - paragraph [ref=e170]: No expense data in this period.
          - generic [ref=e171]:
            - heading "Income by Category" [level=2] [ref=e173]:
              - img [ref=e174]
              - text: Income by Category
            - paragraph [ref=e179]: No income data in this period.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e185] [cursor=pointer]:
    - img [ref=e186]
  - alert [ref=e189]
```

# Test source

```ts
  23  |       await expect(page.getByText("Create an account")).toBeVisible()
  24  |       await expect(page.getByLabel("Name")).toBeVisible()
  25  |       await expect(page.getByLabel("Email")).toBeVisible()
  26  |       await expect(page.getByLabel("Password")).toBeVisible()
  27  |       await expect(
  28  |         page.getByRole("button", { name: "Create Account" })
  29  |       ).toBeVisible()
  30  |     })
  31  | 
  32  |     test("shows error for short password", async ({ page }) => {
  33  |       await page.goto("/register")
  34  |       await page.getByLabel("Name").fill("Test")
  35  |       await page.getByLabel("Email").fill("test@example.com")
  36  |       await page.getByLabel("Password").fill("12345") // < 6 chars
  37  |       await page.getByRole("button", { name: "Create Account" }).click()
  38  | 
  39  |       await expect(
  40  |         page.getByText("Password must be at least 6 characters")
  41  |       ).toBeVisible()
  42  |     })
  43  | 
  44  |     test("successful registration redirects to /login", async ({ page }) => {
  45  |       await page.goto("/register")
  46  |       await page.getByLabel("Name").fill(TEST_USER.name)
  47  |       await page.getByLabel("Email").fill(TEST_USER.email)
  48  |       await page.getByLabel("Password").fill(TEST_USER.password)
  49  |       await page.getByRole("button", { name: "Create Account" }).click()
  50  | 
  51  |       await page.waitForURL("/login", { timeout: 10000 })
  52  |       await expect(page.getByText("Welcome back")).toBeVisible()
  53  |     })
  54  | 
  55  |     test("shows error for duplicate email", async ({ page }) => {
  56  |       // Register again with the same email (already created in previous test)
  57  |       await page.goto("/register")
  58  |       await page.getByLabel("Name").fill("Duplicate")
  59  |       await page.getByLabel("Email").fill(TEST_USER.email)
  60  |       await page.getByLabel("Password").fill(TEST_USER.password)
  61  |       await page.getByRole("button", { name: "Create Account" }).click()
  62  | 
  63  |       await expect(
  64  |         page.getByText("Email already registered")
  65  |       ).toBeVisible({ timeout: 10000 })
  66  |     })
  67  |   })
  68  | 
  69  |   // ── Login ─────────────────────────────────
  70  | 
  71  |   test.describe("Login", () => {
  72  |     test("renders login form with all required fields", async ({ page }) => {
  73  |       await page.goto("/login")
  74  | 
  75  |       await expect(page.getByText("Welcome back")).toBeVisible()
  76  |       await expect(page.getByLabel("Email")).toBeVisible()
  77  |       await expect(page.getByLabel("Password")).toBeVisible()
  78  |       await expect(
  79  |         page.getByRole("button", { name: "Sign In" })
  80  |       ).toBeVisible()
  81  |     })
  82  | 
  83  |     test("shows error for invalid credentials", async ({ page }) => {
  84  |       await page.goto("/login")
  85  |       await page.getByLabel("Email").fill("nonexistent@test.com")
  86  |       await page.getByLabel("Password").fill("WrongPass1!")
  87  |       await page.getByRole("button", { name: "Sign In" }).click()
  88  | 
  89  |       await expect(
  90  |         page.getByText("Invalid email or password")
  91  |       ).toBeVisible({ timeout: 10000 })
  92  |     })
  93  | 
  94  |     test("successful login redirects to /dashboard", async ({ page }) => {
  95  |       await page.goto("/login")
  96  |       await page.getByLabel("Email").fill(TEST_USER.email)
  97  |       await page.getByLabel("Password").fill(TEST_USER.password)
  98  |       await page.getByRole("button", { name: "Sign In" }).click()
  99  | 
  100 |       await page.waitForURL("/dashboard", { timeout: 10000 })
  101 |       await expect(page.getByText("Dashboard")).toBeVisible()
  102 |     })
  103 |   })
  104 | 
  105 |   // ── Protected routes ──────────────────────
  106 | 
  107 |   test.describe("Protected routes redirect", () => {
  108 |     const protectedRoutes = [
  109 |       { path: "/dashboard", label: "Dashboard" },
  110 |       { path: "/transactions", label: "Transactions" },
  111 |       { path: "/budgets", label: "Budgets" },
  112 |       { path: "/gold", label: "Gold" },
  113 |       { path: "/stocks", label: "Stocks" },
  114 |       { path: "/recurring", label: "Recurring" },
  115 |       { path: "/reports", label: "Reports" },
  116 |       { path: "/settings", label: "Settings" },
  117 |     ]
  118 | 
  119 |     for (const { path, label } of protectedRoutes) {
  120 |       test(`redirects ${label} to /login`, async ({ page }) => {
  121 |         await page.goto(path)
  122 |         // Wait for the proxy to redirect to the login page
> 123 |         await page.waitForURL(/\/login/, { timeout: 10000 })
      |                    ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  124 |         expect(page.url()).toContain("/login")
  125 |       })
  126 |     }
  127 | 
  128 |     test("redirect includes callbackUrl query parameter", async ({ page }) => {
  129 |       await page.goto("/settings")
  130 |       await page.waitForURL(/\/login/, { timeout: 10000 })
  131 | 
  132 |       const url = new URL(page.url())
  133 |       expect(url.searchParams.get("callbackUrl")).toBe("/settings")
  134 |     })
  135 |   })
  136 | 
  137 |   // ── callbackUrl flow ──────────────────────
  138 | 
  139 |   test.describe("callbackUrl flow", () => {
  140 |     test("redirects back after login via callbackUrl", async ({ page }) => {
  141 |       // 1. Access a protected route while logged out
  142 |       await page.goto("/budgets")
  143 |       await page.waitForURL(/\/login/, { timeout: 10000 })
  144 | 
  145 |       // 2. Verify callbackUrl is set
  146 |       const url = new URL(page.url())
  147 |       expect(url.searchParams.get("callbackUrl")).toBe("/budgets")
  148 | 
  149 |       // 3. Log in — should redirect to /budgets (not /dashboard)
  150 |       await page.getByLabel("Email").fill(TEST_USER.email)
  151 |       await page.getByLabel("Password").fill(TEST_USER.password)
  152 |       await page.getByRole("button", { name: "Sign In" }).click()
  153 | 
  154 |       await page.waitForURL("/budgets", { timeout: 10000 })
  155 |       await expect(page.getByText("Budgets")).toBeVisible()
  156 |     })
  157 |   })
  158 | })
  159 | 
  160 | // ─── Authenticated tests ─────────────────────
  161 | 
  162 | test.describe("Authenticated — Dashboard access", () => {
  163 |   // Uses the default storageState from the setup project (authenticated session)
  164 | 
  165 |   test("dashboard loads for authenticated user", async ({ page }) => {
  166 |     await page.goto("/dashboard")
  167 |     await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 10000 })
  168 |   })
  169 | 
  170 |   test("settings page loads for authenticated user", async ({ page }) => {
  171 |     await page.goto("/settings")
  172 |     await expect(page.getByText("Settings")).toBeVisible({ timeout: 10000 })
  173 |   })
  174 | 
  175 |   test("transactions page loads for authenticated user", async ({ page }) => {
  176 |     await page.goto("/transactions")
  177 |     await expect(page.getByText("Transactions")).toBeVisible()
  178 |   })
  179 | 
  180 |   test("gold page loads for authenticated user", async ({ page }) => {
  181 |     await page.goto("/gold")
  182 |     await expect(page.getByText("Gold")).toBeVisible()
  183 |   })
  184 | 
  185 |   test("stocks page loads for authenticated user", async ({ page }) => {
  186 |     await page.goto("/stocks")
  187 |     await expect(page.getByText("Stocks")).toBeVisible()
  188 |   })
  189 | 
  190 |   test("recurring page loads for authenticated user", async ({ page }) => {
  191 |     await page.goto("/recurring")
  192 |     await expect(page.getByText("Recurring")).toBeVisible()
  193 |   })
  194 | 
  195 |   test("reports page loads for authenticated user", async ({ page }) => {
  196 |     await page.goto("/reports")
  197 |     await expect(page.getByText("Reports")).toBeVisible()
  198 |   })
  199 | 
  200 |   test("budgets page loads for authenticated user", async ({ page }) => {
  201 |     await page.goto("/budgets")
  202 |     await expect(page.getByText("Budgets")).toBeVisible()
  203 |   })
  204 | 
  205 |   test("authenticated API returns dashboard data", async ({ request }) => {
  206 |     // Uses the authenticated request from the setup's storage state
  207 |     const res = await request.get("/api/dashboard")
  208 |     expect(res.ok()).toBeTruthy()
  209 |   })
  210 | })
  211 | 
```