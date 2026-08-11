# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Authenticated — Dashboard access >> stocks page loads for authenticated user
- Location: e2e/tests/auth-flow.spec.ts:185:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Stocks')
Expected: visible
Error: strict mode violation: getByText('Stocks') resolved to 3 elements:
    1) <span class="flex-1">Stocks</span> aka getByRole('link', { name: 'Stocks' })
    2) <h1 class="text-2xl font-bold tracking-tight">Stocks</h1> aka getByRole('heading', { name: 'Stocks', exact: true })
    3) <h2 class="tracking-tight text-sm font-medium">Total Stocks</h2> aka getByRole('heading', { name: 'Total Stocks' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Stocks')

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
          - generic [ref=e80]: U
          - generic [ref=e81]:
            - paragraph [ref=e82]: User
            - paragraph
        - generic [ref=e83]:
          - button "Toggle theme" [ref=e84]:
            - img
            - generic [ref=e85]: Toggle theme
          - button "Sign out" [ref=e86]:
            - img
    - main [ref=e87]:
      - generic [ref=e89]:
        - generic [ref=e90]:
          - generic [ref=e91]:
            - heading "Stocks" [level=1] [ref=e92]
            - paragraph [ref=e93]: Track your stock portfolio
          - generic [ref=e94]:
            - button "Refresh Prices" [ref=e95]:
              - img
              - text: Refresh Prices
            - button "Add Stock" [ref=e96]:
              - img
              - text: Add Stock
        - generic [ref=e97]:
          - generic [ref=e98]:
            - generic [ref=e99]:
              - heading "Total Stocks" [level=2] [ref=e100]
              - img [ref=e101]
            - generic [ref=e104]:
              - generic [ref=e105]: "0"
              - paragraph [ref=e106]: Different companies
          - generic [ref=e107]:
            - generic [ref=e108]:
              - heading "Total Lots" [level=2] [ref=e109]
              - img [ref=e110]
            - generic [ref=e113]:
              - generic [ref=e114]: "0"
              - paragraph [ref=e115]: 0 shares
          - generic [ref=e116]:
            - generic [ref=e117]:
              - heading "Total Invested" [level=2] [ref=e118]
              - img [ref=e119]
            - generic [ref=e123]: Rp 0
          - generic [ref=e124]:
            - generic [ref=e125]:
              - heading "Market Value" [level=2] [ref=e126]
              - img [ref=e127]
            - generic [ref=e130]:
              - generic [ref=e131]: Rp 0
              - paragraph [ref=e132]: +Rp 0 (+0.0%)
        - generic [ref=e133]:
          - generic [ref=e134]:
            - generic [ref=e135]:
              - heading "Dividend Income" [level=2] [ref=e136]:
                - img [ref=e137]
                - text: Dividend Income
              - paragraph [ref=e143]: Record dividend payouts from your holdings
            - button "Add Dividend" [disabled]:
              - img
              - text: Add Dividend
          - img [ref=e146]
        - generic [ref=e148]:
          - generic [ref=e149]:
            - img [ref=e150]
            - textbox "Search by symbol or name..." [ref=e153]
          - paragraph [ref=e154]: Click "Refresh Prices" to get live data
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e166] [cursor=pointer]:
    - img [ref=e167]
  - alert [ref=e170]
```

# Test source

```ts
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
  123 |         await page.waitForURL(/\/login/, { timeout: 10000 })
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
> 187 |     await expect(page.getByText("Stocks")).toBeVisible()
      |                                            ^ Error: expect(locator).toBeVisible() failed
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