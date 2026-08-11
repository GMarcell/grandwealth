# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Unauthenticated — Auth Flow >> Login >> successful login redirects to /dashboard
- Location: e2e/tests/auth-flow.spec.ts:94:9

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation to "/dashboard" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e7]
      - heading "Welcome back" [level=2] [ref=e10]
      - generic [ref=e11]: Sign in to your GrandWealth account
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Invalid email or password
        - generic [ref=e15]:
          - text: Email
          - textbox "Email" [ref=e16]:
            - /placeholder: name@example.com
            - text: e2e-auth-1785822553865@test.grandwealth.app
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e19]: Password
            - link "Forgot password?" [ref=e20] [cursor=pointer]:
              - /url: /forgot-password
          - textbox "Password" [ref=e21]:
            - /placeholder: Enter your password
            - text: TestPass123!
        - button "Sign In" [ref=e22]
      - generic [ref=e23]:
        - text: Don't have an account?
        - link "Create one" [ref=e24] [cursor=pointer]:
          - /url: /register
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e30] [cursor=pointer]:
    - img [ref=e31]
  - alert [ref=e34]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test"
  2   | 
  3   | // Unique test user for the unauthenticated flow tests.
  4   | // Date.now() ensures a fresh user for each test run.
  5   | const TEST_USER = {
  6   |   name: "Auth Test User",
  7   |   email: `e2e-auth-${Date.now()}@test.grandwealth.app`,
  8   |   password: "TestPass123!",
  9   | }
  10  | 
  11  | // ─── Unauthenticated tests ───────────────────
  12  | 
  13  | test.describe("Unauthenticated — Auth Flow", () => {
  14  |   // Override storageState so these tests run without authentication
  15  |   test.use({ storageState: undefined })
  16  | 
  17  |   // ── Registration ──────────────────────────
  18  | 
  19  |   test.describe.serial("Registration", () => {
  20  |     test("renders registration form with all required fields", async ({ page }) => {
  21  |       await page.goto("/register")
  22  | 
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
> 100 |       await page.waitForURL("/dashboard", { timeout: 10000 })
      |                  ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
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
```