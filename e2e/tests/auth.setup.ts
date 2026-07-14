import { test as setup, expect } from "@playwright/test"
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

  // 2. Log in via the login page
  await page.goto("/login")
  await page.fill('input[name="email"]', TEST_USER.email)
  await page.fill('input[name="password"]', TEST_USER.password)
  await page.click('button[type="submit"]')

  // 3. Wait for redirect to dashboard (successful login)
  await page.waitForURL("/dashboard", { timeout: 10000 })

  // 4. Save authenticated state
  await context.storageState({ path: AUTH_FILE })
})
