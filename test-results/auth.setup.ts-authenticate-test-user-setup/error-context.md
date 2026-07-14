# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate test user
- Location: e2e/tests/auth.setup.ts:16:6

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { test as setup, expect } from "@playwright/test"
  2  | import path from "path"
  3  | 
  4  | const AUTH_FILE = path.resolve(__dirname, "../.auth/user.json")
  5  | 
  6  | const TEST_USER = {
  7  |   name: "E2E Test User",
  8  |   email: `e2e-budget-${Date.now()}@test.grandwealth.app`,
  9  |   password: "TestPass123!",
  10 | }
  11 | 
  12 | /**
  13 |  * Register a test user via the API and authenticate via the UI.
  14 |  * Saves the storage state for reuse across tests.
  15 |  */
  16 | setup("authenticate test user", async ({ page, context }) => {
  17 |   // 1. Register via API
  18 |   const registerRes = await page.request.post("/api/auth/register", {
  19 |     data: TEST_USER,
  20 |   })
> 21 |   expect(registerRes.ok()).toBeTruthy()
     |                            ^ Error: expect(received).toBeTruthy()
  22 | 
  23 |   // 2. Log in via the login page
  24 |   await page.goto("/login")
  25 |   await page.fill('input[name="email"]', TEST_USER.email)
  26 |   await page.fill('input[name="password"]', TEST_USER.password)
  27 |   await page.click('button[type="submit"]')
  28 | 
  29 |   // 3. Wait for redirect to dashboard (successful login)
  30 |   await page.waitForURL("/dashboard", { timeout: 10000 })
  31 | 
  32 |   // 4. Save authenticated state
  33 |   await context.storageState({ path: AUTH_FILE })
  34 | })
  35 | 
```