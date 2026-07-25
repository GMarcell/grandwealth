import { test as setup } from "@playwright/test"
import path from "path"
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const AUTH_FILE = path.resolve(__dirname, "../../.auth/user.json")

const TEST_USER = {
  name: "E2E Test User",
  email: `e2e-budget-${Date.now()}@test.grandwealth.app`,
  password: "TestPass123!",
}

/**
 * Register a test user directly via Prisma (bypasses API rate limiting)
 * and authenticate via the UI.
 * Saves the storage state for reuse across tests.
 */
setup("authenticate test user", async ({ page, context }) => {
  // 1. Create user directly via Prisma (bypasses API rate limit)
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.user.findUnique({ where: { email: TEST_USER.email } })
    if (!existing) {
      const hashedPassword = await hash(TEST_USER.password, 12)
      await prisma.user.create({
        data: {
          name: TEST_USER.name,
          email: TEST_USER.email,
          password: hashedPassword,
        },
      })
      console.log(`Created test user: ${TEST_USER.email}`)
    }
  } finally {
    await prisma.$disconnect()
  }

  // 2. Navigate to login and wait for the page to be fully interactive
  await page.goto("/login", { waitUntil: "networkidle" })
  await page.waitForSelector('input[name="email"]', { state: "visible", timeout: 10000 })

  // 3. Log in via the login page UI
  await page.fill('input[name="email"]', TEST_USER.email)
  await page.fill('input[name="password"]', TEST_USER.password)
  await page.click('button[type="submit"]')

  // 4. Wait for dashboard or detect errors
  try {
    await page.waitForURL("/dashboard", { timeout: 15000 })
    console.log("Login successful via UI")
  } catch {
    const currentUrl = page.url()
    console.log(`UI login redirected to: ${currentUrl}`)

    // If the UI login failed, authenticate via the API directly
    console.log("Attempting API-based authentication...")

    // Fetch the CSRF token from NextAuth
    const csrfRes = await page.request.get("/api/auth/csrf")
    if (!csrfRes.ok()) {
      throw new Error(`Failed to fetch CSRF token: ${csrfRes.status()}`)
    }
    const csrfData = await csrfRes.json()
    const csrfToken = csrfData?.csrfToken
    if (!csrfToken) {
      throw new Error(`CSRF token not found in response from /api/auth/csrf: ${JSON.stringify(csrfData)}`)
    }
    console.log("CSRF token fetched successfully")

    // POST credentials directly using the page's request context
    const response = await page.request.post("/api/auth/callback/credentials", {
      form: {
        email: TEST_USER.email,
        password: TEST_USER.password,
        callbackUrl: "/dashboard",
        csrfToken,
      },
    })

    console.log(`API auth response status: ${response.status()}`)

    // Accept 2xx success and 3xx redirect (NextAuth may return 302 with Set-Cookie)
    const status = response.status()
    if (status >= 200 && status < 400) {
      // Navigate to dashboard to confirm we're authenticated
      await page.goto("/dashboard", { waitUntil: "networkidle" })
      console.log(`After API auth, at: ${page.url()}`)

      if (!page.url().includes("/dashboard")) {
        throw new Error(`API auth succeeded but redirect to /dashboard failed. At: ${page.url()}`)
      }
    } else {
      const errorBody = await response.text().catch(() => "(empty)")
      throw new Error(
        `API authentication failed with status ${status}. ` +
        `Response: ${errorBody.slice(0, 200)}. ` +
        `URL after attempt: ${page.url()}`
      )
    }
  }

  // 5. Save authenticated state
  await context.storageState({ path: AUTH_FILE })
  console.log("Auth state saved to", AUTH_FILE)
})
