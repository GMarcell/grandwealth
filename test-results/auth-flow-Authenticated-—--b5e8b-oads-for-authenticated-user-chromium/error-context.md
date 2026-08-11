# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Authenticated — Dashboard access >> settings page loads for authenticated user
- Location: e2e/tests/auth-flow.spec.ts:170:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Settings')
Expected: visible
Error: strict mode violation: getByText('Settings') resolved to 3 elements:
    1) <span class="flex-1">Settings</span> aka getByRole('link', { name: 'Settings' })
    2) <h1 class="text-2xl font-bold tracking-tight">Settings</h1> aka getByRole('heading', { name: 'Settings' })
    3) <div class="text-sm text-muted-foreground">Customize your display settings</div> aka getByText('Customize your display')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Settings')

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
          - heading "Settings" [level=1] [ref=e91]
          - paragraph [ref=e92]: Manage your account and preferences
        - generic [ref=e93]:
          - generic [ref=e94]:
            - heading "Account" [level=2] [ref=e95]:
              - img [ref=e96]
              - text: Account
            - generic [ref=e99]: Your account information
          - generic [ref=e101]:
            - generic [ref=e102]: U
            - generic [ref=e103]:
              - paragraph [ref=e104]: User
              - img [ref=e106]
        - generic [ref=e109]:
          - generic [ref=e110]:
            - heading "Budget Cycle" [level=2] [ref=e111]:
              - img [ref=e112]
              - text: Budget Cycle
            - generic [ref=e114]: "Set the day your budget month starts (default: 1st)"
          - generic [ref=e116]:
            - text: Budget Month Starts On
            - generic [ref=e117]:
              - combobox [ref=e118]:
                - img [ref=e119]
              - combobox [ref=e121]
              - paragraph [ref=e122]: Budget months align with calendar months
        - generic [ref=e123]:
          - generic [ref=e124]:
            - heading "Appearance" [level=2] [ref=e125]:
              - img [ref=e126]
              - text: Appearance
            - generic [ref=e132]: Customize your display settings
          - generic [ref=e134]:
            - button "Light" [ref=e135]:
              - img
              - text: Light
            - button "Dark" [ref=e136]:
              - img
              - text: Dark
            - button "System" [ref=e137]:
              - img
              - text: System
        - generic [ref=e138]:
          - generic [ref=e139]:
            - generic [ref=e140]:
              - heading "Custom Categories" [level=2] [ref=e141]:
                - img [ref=e142]
                - text: Custom Categories
              - generic [ref=e145]: Create your own income and expense categories beyond the defaults
            - button "New Category" [ref=e146]:
              - img
              - text: New Category
          - generic [ref=e147]:
            - generic [ref=e148]:
              - heading "Expense Categories" [level=4] [ref=e149]:
                - img [ref=e150]
                - text: Expense Categories
              - generic [ref=e153]:
                - generic [ref=e154]:
                  - generic [ref=e155]: FOOD
                  - combobox [ref=e156]:
                    - generic: 50/30/20
                    - img [ref=e157]
                  - combobox [ref=e159]
                - generic [ref=e160]:
                  - generic [ref=e161]: TRANSPORTATION
                  - combobox [ref=e162]:
                    - generic: 50/30/20
                    - img [ref=e163]
                  - combobox [ref=e165]
                - generic [ref=e166]:
                  - generic [ref=e167]: HOUSING
                  - combobox [ref=e168]:
                    - generic: 50/30/20
                    - img [ref=e169]
                  - combobox [ref=e171]
                - generic [ref=e172]:
                  - generic [ref=e173]: UTILITIES
                  - combobox [ref=e174]:
                    - generic: 50/30/20
                    - img [ref=e175]
                  - combobox [ref=e177]
                - generic [ref=e178]:
                  - generic [ref=e179]: HEALTHCARE
                  - combobox [ref=e180]:
                    - generic: 50/30/20
                    - img [ref=e181]
                  - combobox [ref=e183]
                - generic [ref=e184]:
                  - generic [ref=e185]: EDUCATION
                  - combobox [ref=e186]:
                    - generic: 50/30/20
                    - img [ref=e187]
                  - combobox [ref=e189]
                - generic [ref=e190]:
                  - generic [ref=e191]: ENTERTAINMENT
                  - combobox [ref=e192]:
                    - generic: 50/30/20
                    - img [ref=e193]
                  - combobox [ref=e195]
                - generic [ref=e196]:
                  - generic [ref=e197]: SHOPPING
                  - combobox [ref=e198]:
                    - generic: 50/30/20
                    - img [ref=e199]
                  - combobox [ref=e201]
                - generic [ref=e202]:
                  - generic [ref=e203]: TRAVEL
                  - combobox [ref=e204]:
                    - generic: 50/30/20
                    - img [ref=e205]
                  - combobox [ref=e207]
                - generic [ref=e208]:
                  - generic [ref=e209]: INSURANCE
                  - combobox [ref=e210]:
                    - generic: 50/30/20
                    - img [ref=e211]
                  - combobox [ref=e213]
                - generic [ref=e214]:
                  - generic [ref=e215]: TAX
                  - combobox [ref=e216]:
                    - generic: 50/30/20
                    - img [ref=e217]
                  - combobox [ref=e219]
                - generic [ref=e220]:
                  - generic [ref=e221]: SUBSCRIPTION
                  - combobox [ref=e222]:
                    - generic: 50/30/20
                    - img [ref=e223]
                  - combobox [ref=e225]
                - generic [ref=e226]:
                  - generic [ref=e227]: OTHER EXPENSE
                  - combobox [ref=e228]:
                    - generic: 50/30/20
                    - img [ref=e229]
                  - combobox [ref=e231]
            - generic [ref=e232]:
              - heading "Income Categories" [level=4] [ref=e233]:
                - img [ref=e234]
                - text: Income Categories
              - generic [ref=e237]:
                - generic [ref=e238]:
                  - generic [ref=e239]: SALARY
                  - combobox [ref=e240]:
                    - generic: 50/30/20
                    - img [ref=e241]
                  - combobox [ref=e243]
                - generic [ref=e244]:
                  - generic [ref=e245]: FREELANCE
                  - combobox [ref=e246]:
                    - generic: 50/30/20
                    - img [ref=e247]
                  - combobox [ref=e249]
                - generic [ref=e250]:
                  - generic [ref=e251]: BUSINESS
                  - combobox [ref=e252]:
                    - generic: 50/30/20
                    - img [ref=e253]
                  - combobox [ref=e255]
                - generic [ref=e256]:
                  - generic [ref=e257]: INVESTMENT
                  - combobox [ref=e258]:
                    - generic: 50/30/20
                    - img [ref=e259]
                  - combobox [ref=e261]
                - generic [ref=e262]:
                  - generic [ref=e263]: DIVIDEND
                  - combobox [ref=e264]:
                    - generic: 50/30/20
                    - img [ref=e265]
                  - combobox [ref=e267]
                - generic [ref=e268]:
                  - generic [ref=e269]: INTEREST
                  - combobox [ref=e270]:
                    - generic: 50/30/20
                    - img [ref=e271]
                  - combobox [ref=e273]
                - generic [ref=e274]:
                  - generic [ref=e275]: RENTAL
                  - combobox [ref=e276]:
                    - generic: 50/30/20
                    - img [ref=e277]
                  - combobox [ref=e279]
                - generic [ref=e280]:
                  - generic [ref=e281]: GIFT
                  - combobox [ref=e282]:
                    - generic: 50/30/20
                    - img [ref=e283]
                  - combobox [ref=e285]
                - generic [ref=e286]:
                  - generic [ref=e287]: REFUND
                  - combobox [ref=e288]:
                    - generic: 50/30/20
                    - img [ref=e289]
                  - combobox [ref=e291]
                - generic [ref=e292]:
                  - generic [ref=e293]: OTHER INCOME
                  - combobox [ref=e294]:
                    - generic: 50/30/20
                    - img [ref=e295]
                  - combobox [ref=e297]
        - generic [ref=e298]:
          - generic [ref=e299]:
            - heading "Danger Zone" [level=2] [ref=e300]:
              - img [ref=e301]
              - text: Danger Zone
            - generic [ref=e303]: Irreversible actions that affect your account
          - generic [ref=e305]:
            - generic [ref=e306]:
              - paragraph [ref=e307]: Delete Account
              - paragraph [ref=e308]: Permanently delete your account and all associated data — transactions, categories, budgets, gold holdings, stocks, recurring transactions, and bank savings. This action cannot be undone.
            - button "Delete My Account" [ref=e309]:
              - img
              - text: Delete My Account
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e315] [cursor=pointer]:
    - img [ref=e316]
  - alert [ref=e319]
```

# Test source

```ts
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
> 172 |     await expect(page.getByText("Settings")).toBeVisible({ timeout: 10000 })
      |                                              ^ Error: expect(locator).toBeVisible() failed
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