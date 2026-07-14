import { test, expect } from "@playwright/test"

// Unique test user for the unauthenticated flow tests.
// Date.now() ensures a fresh user for each test run.
const TEST_USER = {
  name: "Auth Test User",
  email: `e2e-auth-${Date.now()}@test.grandwealth.app`,
  password: "TestPass123!",
}

// ─── Unauthenticated tests ───────────────────

test.describe("Unauthenticated — Auth Flow", () => {
  // Override storageState so these tests run without authentication
  test.use({ storageState: undefined })

  // ── Registration ──────────────────────────

  test.describe.serial("Registration", () => {
    test("renders registration form with all required fields", async ({ page }) => {
      await page.goto("/register")

      await expect(page.getByText("Create an account")).toBeVisible()
      await expect(page.getByLabel("Name")).toBeVisible()
      await expect(page.getByLabel("Email")).toBeVisible()
      await expect(page.getByLabel("Password")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Create Account" })
      ).toBeVisible()
    })

    test("shows error for short password", async ({ page }) => {
      await page.goto("/register")
      await page.getByLabel("Name").fill("Test")
      await page.getByLabel("Email").fill("test@example.com")
      await page.getByLabel("Password").fill("12345") // < 6 chars
      await page.getByRole("button", { name: "Create Account" }).click()

      await expect(
        page.getByText("Password must be at least 6 characters")
      ).toBeVisible()
    })

    test("successful registration redirects to /login", async ({ page }) => {
      await page.goto("/register")
      await page.getByLabel("Name").fill(TEST_USER.name)
      await page.getByLabel("Email").fill(TEST_USER.email)
      await page.getByLabel("Password").fill(TEST_USER.password)
      await page.getByRole("button", { name: "Create Account" }).click()

      await page.waitForURL("/login", { timeout: 10000 })
      await expect(page.getByText("Welcome back")).toBeVisible()
    })

    test("shows error for duplicate email", async ({ page }) => {
      // Register again with the same email (already created in previous test)
      await page.goto("/register")
      await page.getByLabel("Name").fill("Duplicate")
      await page.getByLabel("Email").fill(TEST_USER.email)
      await page.getByLabel("Password").fill(TEST_USER.password)
      await page.getByRole("button", { name: "Create Account" }).click()

      await expect(
        page.getByText("Email already registered")
      ).toBeVisible({ timeout: 10000 })
    })
  })

  // ── Login ─────────────────────────────────

  test.describe("Login", () => {
    test("renders login form with all required fields", async ({ page }) => {
      await page.goto("/login")

      await expect(page.getByText("Welcome back")).toBeVisible()
      await expect(page.getByLabel("Email")).toBeVisible()
      await expect(page.getByLabel("Password")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Sign In" })
      ).toBeVisible()
    })

    test("shows error for invalid credentials", async ({ page }) => {
      await page.goto("/login")
      await page.getByLabel("Email").fill("nonexistent@test.com")
      await page.getByLabel("Password").fill("WrongPass1!")
      await page.getByRole("button", { name: "Sign In" }).click()

      await expect(
        page.getByText("Invalid email or password")
      ).toBeVisible({ timeout: 10000 })
    })

    test("successful login redirects to /dashboard", async ({ page }) => {
      await page.goto("/login")
      await page.getByLabel("Email").fill(TEST_USER.email)
      await page.getByLabel("Password").fill(TEST_USER.password)
      await page.getByRole("button", { name: "Sign In" }).click()

      await page.waitForURL("/dashboard", { timeout: 10000 })
      await expect(page.getByText("Dashboard")).toBeVisible()
    })
  })

  // ── Protected routes ──────────────────────

  test.describe("Protected routes redirect", () => {
    const protectedRoutes = [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/transactions", label: "Transactions" },
      { path: "/budgets", label: "Budgets" },
      { path: "/gold", label: "Gold" },
      { path: "/stocks", label: "Stocks" },
      { path: "/recurring", label: "Recurring" },
      { path: "/reports", label: "Reports" },
      { path: "/settings", label: "Settings" },
    ]

    for (const { path, label } of protectedRoutes) {
      test(`redirects ${label} to /login`, async ({ page }) => {
        await page.goto(path)
        // Wait for the proxy to redirect to the login page
        await page.waitForURL(/\/login/, { timeout: 10000 })
        expect(page.url()).toContain("/login")
      })
    }

    test("redirect includes callbackUrl query parameter", async ({ page }) => {
      await page.goto("/settings")
      await page.waitForURL(/\/login/, { timeout: 10000 })

      const url = new URL(page.url())
      expect(url.searchParams.get("callbackUrl")).toBe("/settings")
    })
  })

  // ── callbackUrl flow ──────────────────────

  test.describe("callbackUrl flow", () => {
    test("redirects back after login via callbackUrl", async ({ page }) => {
      // 1. Access a protected route while logged out
      await page.goto("/budgets")
      await page.waitForURL(/\/login/, { timeout: 10000 })

      // 2. Verify callbackUrl is set
      const url = new URL(page.url())
      expect(url.searchParams.get("callbackUrl")).toBe("/budgets")

      // 3. Log in — should redirect to /budgets (not /dashboard)
      await page.getByLabel("Email").fill(TEST_USER.email)
      await page.getByLabel("Password").fill(TEST_USER.password)
      await page.getByRole("button", { name: "Sign In" }).click()

      await page.waitForURL("/budgets", { timeout: 10000 })
      await expect(page.getByText("Budgets")).toBeVisible()
    })
  })
})

// ─── Authenticated tests ─────────────────────

test.describe("Authenticated — Dashboard access", () => {
  // Uses the default storageState from the setup project (authenticated session)

  test("dashboard loads for authenticated user", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 10000 })
  })

  test("settings page loads for authenticated user", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByText("Settings")).toBeVisible({ timeout: 10000 })
  })

  test("transactions page loads for authenticated user", async ({ page }) => {
    await page.goto("/transactions")
    await expect(page.getByText("Transactions")).toBeVisible()
  })

  test("gold page loads for authenticated user", async ({ page }) => {
    await page.goto("/gold")
    await expect(page.getByText("Gold")).toBeVisible()
  })

  test("stocks page loads for authenticated user", async ({ page }) => {
    await page.goto("/stocks")
    await expect(page.getByText("Stocks")).toBeVisible()
  })

  test("recurring page loads for authenticated user", async ({ page }) => {
    await page.goto("/recurring")
    await expect(page.getByText("Recurring")).toBeVisible()
  })

  test("reports page loads for authenticated user", async ({ page }) => {
    await page.goto("/reports")
    await expect(page.getByText("Reports")).toBeVisible()
  })

  test("budgets page loads for authenticated user", async ({ page }) => {
    await page.goto("/budgets")
    await expect(page.getByText("Budgets")).toBeVisible()
  })

  test("authenticated API returns dashboard data", async ({ request }) => {
    // Uses the authenticated request from the setup's storage state
    const res = await request.get("/api/dashboard")
    expect(res.ok()).toBeTruthy()
  })
})
