# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Unauthenticated — Auth Flow >> Protected routes redirect >> redirect includes callbackUrl query parameter
- Location: e2e/tests/auth-flow.spec.ts:128:9

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:3000/settings"
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
          - heading "Settings" [level=1] [ref=e92]
          - paragraph [ref=e93]: Manage your account and preferences
        - generic [ref=e94]:
          - generic [ref=e95]:
            - heading "Account" [level=2] [ref=e96]:
              - img [ref=e97]
              - text: Account
            - generic [ref=e100]: Your account information
          - generic [ref=e102]:
            - generic [ref=e103]: E
            - generic [ref=e104]:
              - paragraph [ref=e105]: E2E Test User
              - generic [ref=e106]:
                - img [ref=e107]
                - text: e2e-budget-1785822541395@test.grandwealth.app
        - generic [ref=e110]:
          - generic [ref=e111]:
            - heading "Budget Cycle" [level=2] [ref=e112]:
              - img [ref=e113]
              - text: Budget Cycle
            - generic [ref=e115]: "Set the day your budget month starts (default: 1st)"
          - generic [ref=e117]:
            - text: Budget Month Starts On
            - generic [ref=e118]:
              - combobox [ref=e119]:
                - generic: 1st
                - img [ref=e120]
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
                - generic [ref=e159]:
                  - generic [ref=e160]: TRANSPORTATION
                  - combobox [ref=e161]:
                    - generic: 50/30/20
                    - img [ref=e162]
                - generic [ref=e164]:
                  - generic [ref=e165]: HOUSING
                  - combobox [ref=e166]:
                    - generic: 50/30/20
                    - img [ref=e167]
                - generic [ref=e169]:
                  - generic [ref=e170]: UTILITIES
                  - combobox [ref=e171]:
                    - generic: 50/30/20
                    - img [ref=e172]
                - generic [ref=e174]:
                  - generic [ref=e175]: HEALTHCARE
                  - combobox [ref=e176]:
                    - generic: 50/30/20
                    - img [ref=e177]
                - generic [ref=e179]:
                  - generic [ref=e180]: EDUCATION
                  - combobox [ref=e181]:
                    - generic: 50/30/20
                    - img [ref=e182]
                - generic [ref=e184]:
                  - generic [ref=e185]: ENTERTAINMENT
                  - combobox [ref=e186]:
                    - generic: 50/30/20
                    - img [ref=e187]
                - generic [ref=e189]:
                  - generic [ref=e190]: SHOPPING
                  - combobox [ref=e191]:
                    - generic: 50/30/20
                    - img [ref=e192]
                - generic [ref=e194]:
                  - generic [ref=e195]: TRAVEL
                  - combobox [ref=e196]:
                    - generic: 50/30/20
                    - img [ref=e197]
                - generic [ref=e199]:
                  - generic [ref=e200]: INSURANCE
                  - combobox [ref=e201]:
                    - generic: 50/30/20
                    - img [ref=e202]
                - generic [ref=e204]:
                  - generic [ref=e205]: TAX
                  - combobox [ref=e206]:
                    - generic: 50/30/20
                    - img [ref=e207]
                - generic [ref=e209]:
                  - generic [ref=e210]: SUBSCRIPTION
                  - combobox [ref=e211]:
                    - generic: 50/30/20
                    - img [ref=e212]
                - generic [ref=e214]:
                  - generic [ref=e215]: OTHER EXPENSE
                  - combobox [ref=e216]:
                    - generic: 50/30/20
                    - img [ref=e217]
            - generic [ref=e219]:
              - heading "Income Categories" [level=4] [ref=e220]:
                - img [ref=e221]
                - text: Income Categories
              - generic [ref=e224]:
                - generic [ref=e225]:
                  - generic [ref=e226]: SALARY
                  - combobox [ref=e227]:
                    - generic: 50/30/20
                    - img [ref=e228]
                - generic [ref=e230]:
                  - generic [ref=e231]: FREELANCE
                  - combobox [ref=e232]:
                    - generic: 50/30/20
                    - img [ref=e233]
                - generic [ref=e235]:
                  - generic [ref=e236]: BUSINESS
                  - combobox [ref=e237]:
                    - generic: 50/30/20
                    - img [ref=e238]
                - generic [ref=e240]:
                  - generic [ref=e241]: INVESTMENT
                  - combobox [ref=e242]:
                    - generic: 50/30/20
                    - img [ref=e243]
                - generic [ref=e245]:
                  - generic [ref=e246]: DIVIDEND
                  - combobox [ref=e247]:
                    - generic: 50/30/20
                    - img [ref=e248]
                - generic [ref=e250]:
                  - generic [ref=e251]: INTEREST
                  - combobox [ref=e252]:
                    - generic: 50/30/20
                    - img [ref=e253]
                - generic [ref=e255]:
                  - generic [ref=e256]: RENTAL
                  - combobox [ref=e257]:
                    - generic: 50/30/20
                    - img [ref=e258]
                - generic [ref=e260]:
                  - generic [ref=e261]: GIFT
                  - combobox [ref=e262]:
                    - generic: 50/30/20
                    - img [ref=e263]
                - generic [ref=e265]:
                  - generic [ref=e266]: REFUND
                  - combobox [ref=e267]:
                    - generic: 50/30/20
                    - img [ref=e268]
                - generic [ref=e270]:
                  - generic [ref=e271]: OTHER INCOME
                  - combobox [ref=e272]:
                    - generic: 50/30/20
                    - img [ref=e273]
        - generic [ref=e275]:
          - generic [ref=e276]:
            - heading "Danger Zone" [level=2] [ref=e277]:
              - img [ref=e278]
              - text: Danger Zone
            - generic [ref=e280]: Irreversible actions that affect your account
          - generic [ref=e282]:
            - generic [ref=e283]:
              - paragraph [ref=e284]: Delete Account
              - paragraph [ref=e285]: Permanently delete your account and all associated data — transactions, categories, budgets, gold holdings, stocks, recurring transactions, and bank savings. This action cannot be undone.
            - button "Delete My Account" [ref=e286]:
              - img
              - text: Delete My Account
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e292] [cursor=pointer]:
    - img [ref=e293]
  - alert [ref=e296]
```

# Test source

```ts
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
  123 |         await page.waitForURL(/\/login/, { timeout: 10000 })
  124 |         expect(page.url()).toContain("/login")
  125 |       })
  126 |     }
  127 | 
  128 |     test("redirect includes callbackUrl query parameter", async ({ page }) => {
  129 |       await page.goto("/settings")
> 130 |       await page.waitForURL(/\/login/, { timeout: 10000 })
      |                  ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
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