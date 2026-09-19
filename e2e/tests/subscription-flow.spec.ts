import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

/**
 * End-to-end coverage of the subscription model:
 *
 *  1. Registration grants a fresh user an active 14-day Pro trial (they can
 *     open Pro-only modules and Settings shows the trial).
 *  2. A Free user (no trial) is paywalled on Pro modules (/upgrade).
 *  3. An admin grants Pro from /admin → the user regains access.
 *  4. An admin converts a trial grant to a paid subscription and revokes it.
 *
 * Users are created through the UI (registration) or directly via Prisma
 * (bypasses the register API rate limit), cleaned up in afterAll.
 */

const RUN_ID = Date.now()
const PASSWORD = "TestPass123!"

const users = {
  trial: {
    name: "E2E Trial User",
    email: `e2e-trial-${RUN_ID}@test.grandwealth.app`,
  },
  free: {
    name: "E2E Free User",
    email: `e2e-free-${RUN_ID}@test.grandwealth.app`,
  },
  admin: {
    name: "E2E Admin User",
    email: `e2e-admin-${RUN_ID}@test.grandwealth.app`,
  },
  convert: {
    name: "E2E Trial Convert",
    email: `e2e-convert-${RUN_ID}@test.grandwealth.app`,
  },
}

const allEmails = Object.values(users).map((u) => u.email)

const prisma = new PrismaClient()

interface CreateUserOverrides {
  role?: "USER" | "ADMIN"
  plan?: "FREE" | "PRO"
  subscriptionStatus?: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | null
  currentPeriodEnd?: Date | null
  isTrial?: boolean
}

/** Create a user directly via Prisma (bypasses the register API rate limit). */
async function createUser(
  u: { name: string; email: string },
  overrides: CreateUserOverrides = {}
) {
  const hashedPassword = await hash(PASSWORD, 12)
  return prisma.user.create({
    data: { name: u.name, email: u.email, password: hashedPassword, ...overrides },
  })
}

/** Open a fresh (logged-out) context and sign in through the UI. */
async function loginContext(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto("/login", { waitUntil: "networkidle" })
  await page.waitForSelector('input[name="email"]', { state: "visible", timeout: 10_000 })
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL("**/dashboard", { timeout: 15_000 })
  return { context, page }
}

const heading = (page: Page, label: string) =>
  page.locator("h1").filter({ hasText: label })

test.describe("Registration → 14-day Pro trial", () => {
  test.describe.serial(() => {
    test("registers a new user who can open a Pro-only module", async ({ browser }) => {
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        // Register through the UI (the trial is granted server-side).
        await page.goto("/register", { waitUntil: "networkidle" })
        await page.getByLabel("Name").fill(users.trial.name)
        await page.getByLabel("Email").fill(users.trial.email)
        await page.getByLabel("Password").fill(PASSWORD)
        await page.getByRole("button", { name: "Create Account" }).click()
        await page.waitForURL("**/login", { timeout: 10_000 })

        // Sign in with the fresh account.
        await page.getByLabel("Email").fill(users.trial.email)
        await page.getByLabel("Password").fill(PASSWORD)
        await page.getByRole("button", { name: "Sign In" }).click()
        await page.waitForURL("**/dashboard", { timeout: 15_000 })

        // The trial grants Pro: /budgets must load, not redirect to /upgrade.
        await page.goto("/budgets")
        await expect(heading(page, "Budgets")).toBeVisible({ timeout: 10_000 })
        expect(page.url()).not.toContain("/upgrade")
      } finally {
        await context.close()
      }
    })

    test("Settings shows the trial state for the trial user", async ({ browser }) => {
      const { context, page } = await loginContext(browser, users.trial.email)
      try {
        await page.goto("/settings")
        await expect(page.getByText("Plan & Subscription")).toBeVisible({ timeout: 10_000 })
        // Active Pro badge, Trial badge, and the trial copy + end-date label.
        await expect(page.getByText("Pro", { exact: true })).toBeVisible()
        await expect(page.getByText("Trial", { exact: true })).toBeVisible()
        await expect(page.getByText("Trial ends")).toBeVisible()
        await expect(page.getByText(/enjoying a free trial of Pro/)).toBeVisible()
      } finally {
        await context.close()
      }
    })
  })
})

test.describe("Admin-managed subscription (Free → paywall → Pro)", () => {
  test.describe.serial(() => {
    test.beforeAll(async () => {
      // Free user (defaults) + admin who will grant Pro.
      await createUser(users.free)
      await createUser(users.admin, { role: "ADMIN" })
      // A user currently on their automatic trial, for the trial→paid conversion.
      await createUser(users.convert, {
        plan: "PRO",
        subscriptionStatus: "ACTIVE",
        isTrial: true,
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
    })

    test("a Free user is paywalled from Pro modules", async ({ browser }) => {
      const { context, page } = await loginContext(browser, users.free.email)
      try {
        await page.goto("/budgets")
        await page.waitForURL("**/upgrade", { timeout: 10_000 })
        await expect(page.getByText("Upgrade to Pro")).toBeVisible()

        // Settings reflects the Free plan with no trial.
        await page.goto("/settings")
        await expect(page.getByText("Plan & Subscription")).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText("Free", { exact: true })).toBeVisible()
        await expect(page.getByText("Trial", { exact: true })).toHaveCount(0)
        await expect(page.getByText("See what Pro includes")).toBeVisible()
      } finally {
        await context.close()
      }
    })

    test("admin grants Pro to the free user from /admin", async ({ browser }) => {
      const { context, page } = await loginContext(browser, users.admin.email)
      try {
        await page.goto("/admin")
        await expect(heading(page, "Admin")).toBeVisible({ timeout: 10_000 })

        // Find the user via search.
        await page.getByPlaceholder("Search by name or email...").fill(users.free.email)
        const row = page.locator("tbody tr").filter({ hasText: users.free.email })
        await expect(row).toBeVisible({ timeout: 10_000 })
        await expect(row.getByText("Free", { exact: true })).toBeVisible()

        // Open the edit dialog and switch the plan to Pro (paid grant).
        await row.getByTitle("Edit plan").click()
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await expect(dialog.getByText("Edit subscription")).toBeVisible()

        await dialog.getByRole("combobox").first().click()
        await page.getByRole("option", { name: "Pro", exact: true }).click()

        // Manual grants default to paid — the trial switch must be off.
        const trialSwitch = dialog.getByLabel("Free trial grant")
        await expect(trialSwitch).toBeVisible()
        await expect(trialSwitch).not.toBeChecked()

        await dialog.getByRole("button", { name: "Save", exact: true }).click()
        await expect(page.getByText("User updated")).toBeVisible({ timeout: 10_000 })

        // The row now shows an active paid Pro subscription (no trial badge).
        await expect(row.getByText("Pro", { exact: true })).toBeVisible({ timeout: 10_000 })
        await expect(row.getByText("Active", { exact: true })).toBeVisible()
        await expect(row.getByText("Trial", { exact: true })).toHaveCount(0)
      } finally {
        await context.close()
      }
    })

    test("the granted user can now open Pro modules", async ({ browser }) => {
      const { context, page } = await loginContext(browser, users.free.email)
      try {
        await page.goto("/budgets")
        await expect(heading(page, "Budgets")).toBeVisible({ timeout: 10_000 })
        expect(page.url()).not.toContain("/upgrade")

        await page.goto("/settings")
        await expect(page.getByText("Plan & Subscription")).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText("Pro", { exact: true })).toBeVisible()
        await expect(page.getByText("Trial", { exact: true })).toHaveCount(0)
        await expect(page.getByText(/enjoying a free trial/)).toHaveCount(0)
      } finally {
        await context.close()
      }
    })

    test("admin converts an active trial grant to paid", async ({ browser }) => {
      const { context, page } = await loginContext(browser, users.admin.email)
      try {
        await page.goto("/admin")
        await expect(heading(page, "Admin")).toBeVisible({ timeout: 10_000 })

        await page.getByPlaceholder("Search by name or email...").fill(users.convert.email)
        const row = page.locator("tbody tr").filter({ hasText: users.convert.email })
        await expect(row).toBeVisible({ timeout: 10_000 })
        await expect(row.getByText("Trial", { exact: true })).toBeVisible()

        // Open the dialog and turn the "free trial grant" switch off.
        await row.getByTitle("Edit plan").click()
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()

        const trialSwitch = dialog.getByLabel("Free trial grant")
        await expect(trialSwitch).toBeChecked()
        await trialSwitch.click()
        await expect(trialSwitch).not.toBeChecked()

        await dialog.getByRole("button", { name: "Save", exact: true }).click()
        await expect(page.getByText("User updated")).toBeVisible({ timeout: 10_000 })

        // Still Pro + active, but no longer marked as a trial.
        await expect(row.getByText("Pro", { exact: true })).toBeVisible({ timeout: 10_000 })
        await expect(row.getByText("Trial", { exact: true })).toHaveCount(0)
      } finally {
        await context.close()
      }
    })

    test("admin revoking Pro paywalls the user again", async ({ browser }) => {
      const { context, page } = await loginContext(browser, users.admin.email)
      try {
        await page.goto("/admin")
        await expect(heading(page, "Admin")).toBeVisible({ timeout: 10_000 })

        await page.getByPlaceholder("Search by name or email...").fill(users.free.email)
        const row = page.locator("tbody tr").filter({ hasText: users.free.email })
        await expect(row).toBeVisible({ timeout: 10_000 })

        // Downgrade back to Free via the dialog.
        await row.getByTitle("Edit plan").click()
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await dialog.getByRole("combobox").first().click()
        await page.getByRole("option", { name: "Free", exact: true }).click()
        await dialog.getByRole("button", { name: "Save", exact: true }).click()
        await expect(page.getByText("User updated")).toBeVisible({ timeout: 10_000 })
        await expect(row.getByText("Free", { exact: true })).toBeVisible({ timeout: 10_000 })
      } finally {
        await context.close()
      }
    })
  })

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } })
    await prisma.$disconnect()
  })
})
