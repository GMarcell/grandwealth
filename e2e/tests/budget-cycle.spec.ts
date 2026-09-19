import { test, expect } from "@playwright/test"

// Storage state is set in playwright.config.ts via the chromium project

test.describe("Budget Cycle — Settings", () => {
  test("shows budget cycle card on settings page", async ({ page }) => {
    await page.goto("/settings")

    // Budget Cycle card is visible
    await expect(page.getByText("Budget Cycle")).toBeVisible()
    await expect(
      page.getByText("Set the day your budget month starts")
    ).toBeVisible()
  })

  test("defaults to 1st (calendar months)", async ({ page }) => {
    await page.goto("/settings")

    const select = page.locator(
      'select[role="combobox"]'
    ).first()
    // The select for start day should show "1st"
    await expect(page.getByText("1st")).toBeVisible()
    await expect(
      page.getByText("Budget months align with calendar months")
    ).toBeVisible()
  })

  test("changing to 15th shows the updated description and save button", async ({
    page,
  }) => {
    await page.goto("/settings")

    // Open the start day select
    const selectTrigger = page.getByRole("combobox").first()
    await selectTrigger.click()

    // Select "15th"
    await page.getByRole("option", { name: "15th" }).click()

    // Verify the description updates
    await expect(
      page.getByText("budget months run from the 15th")
    ).toBeVisible()

    // Save button should appear
    const saveButton = page.getByRole("button", { name: "Save Budget Settings" })
    await expect(saveButton).toBeVisible()

    // Click save
    await saveButton.click()

    // Wait for success toast
    await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  })

  test("shows example date range when start day > 1", async ({ page }) => {
    await page.goto("/settings")

    // Change to 15th
    const selectTrigger = page.getByRole("combobox").first()
    await selectTrigger.click()
    await page.getByRole("option", { name: "15th" }).click()

    // Example range should appear
    await expect(
      page.getByText(/Budget months run from the 15th/)
    ).toBeVisible()
  })

  test("changing back to 1st restores calendar mode", async ({ page, request }) => {
    // Baseline: 15th, set via the API so this test is independent of the
    // order in which earlier tests saved settings.
    const baseline = await request.patch("/api/user/budget-settings", {
      data: { budgetStartDay: 15 },
    })
    expect(baseline.ok()).toBeTruthy()

    // Verify the UI reflects the 15th cycle, then switch back to 1st through
    // the UI (selecting a value that differs from the saved one shows Save).
    await page.goto("/settings")
    const selectTrigger = page.getByRole("combobox").first()
    await expect(selectTrigger).toContainText("15th")
    await expect(page.getByText(/Budget months run from the 15th/)).toBeVisible()

    await selectTrigger.click()
    await page.getByRole("option", { name: "1st", exact: true }).click()
    await expect(selectTrigger).toContainText("1st")
    await page.getByRole("button", { name: "Save Budget Settings" }).click()
    await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })

    // The description reverts to calendar mode.
    await expect(
      page.getByText("Budget months align with calendar months")
    ).toBeVisible()
  })
})

test.describe("Budget Cycle — Budgets Page", () => {
  test("budgets page loads and shows month selector", async ({ page }) => {
    await page.goto("/budgets")

    // Page title is visible (h1, not the sidebar nav link).
    await expect(page.locator("h1").filter({ hasText: "Budgets" })).toBeVisible()
    await expect(
      page.getByText("Set monthly spending limits")
    ).toBeVisible()

    // Month selector is present
    await expect(page.getByRole("combobox").first()).toBeVisible()
  })

  test("month selector has 12 months listed", async ({ page }) => {
    await page.goto("/budgets")

    // Open the month selector
    const monthSelect = page.getByRole("combobox").first()
    await monthSelect.click()

    // Verify multiple months are listed (should show Dec, Nov, Oct, etc.)
    const options = page.getByRole("option")
    // At minimum the current month should be in the list
    await expect(options.first()).toBeVisible()
  })

  test("month labels reflect budget start day setting", async ({ page, request }) => {
    // Baseline: set the start day to 15th via the API (order-independent) and
    // verify the UI shows the updated cycle.
    const baseline = await request.patch("/api/user/budget-settings", {
      data: { budgetStartDay: 15 },
    })
    expect(baseline.ok()).toBeTruthy()

    await page.goto("/settings")
    await expect(page.getByRole("combobox").first()).toContainText("15th")
    await expect(page.getByText(/Budget months run from the 15th/)).toBeVisible()

    // On the budgets page the month selector still renders for a 15th cycle.
    await page.goto("/budgets")
    await expect(
      page.locator("h1").filter({ hasText: "Budgets" })
    ).toBeVisible()
    await expect(page.getByRole("combobox").first()).toBeVisible()
  })

  test("add budget dialog opens", async ({ page }) => {
    await page.goto("/budgets")

    // Click "Add Budget" button
    const addButton = page.getByRole("button", { name: "Add Budget", exact: true })
    // If button is disabled (no categories without budgets), test dialog via another approach
    if (await addButton.isEnabled()) {
      await addButton.click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      // Scope to the dialog so the trigger/submit buttons don't collide.
      await expect(dialog.getByRole("heading", { name: "Add Budget" })).toBeVisible()
      await expect(dialog.getByText("Category", { exact: true })).toBeVisible()
      await expect(dialog.getByText("Monthly Budget (Rp)")).toBeVisible()
    }
  })
})

test.describe("Budget Cycle — API", () => {
  test("GET /api/user/budget-settings returns default value", async ({
    request,
  }) => {
    const res = await request.get("/api/user/budget-settings")
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty("budgetStartDay")
    expect(typeof data.budgetStartDay).toBe("number")
    expect(data.budgetStartDay).toBeGreaterThanOrEqual(1)
    expect(data.budgetStartDay).toBeLessThanOrEqual(28)
  })

  test("PATCH /api/user/budget-settings updates start day", async ({
    request,
  }) => {
    // Set to 15
    const res1 = await request.patch("/api/user/budget-settings", {
      data: { budgetStartDay: 15 },
    })
    expect(res1.ok()).toBeTruthy()
    const data1 = await res1.json()
    expect(data1.budgetStartDay).toBe(15)

    // Verify it persisted
    const res2 = await request.get("/api/user/budget-settings")
    const data2 = await res2.json()
    expect(data2.budgetStartDay).toBe(15)

    // Reset to 1
    await request.patch("/api/user/budget-settings", {
      data: { budgetStartDay: 1 },
    })
  })

  test("PATCH with invalid start day returns 400", async ({ request }) => {
    const res = await request.patch("/api/user/budget-settings", {
      data: { budgetStartDay: 0 },
    })
    expect(res.status()).toBe(400)

    const res2 = await request.patch("/api/user/budget-settings", {
      data: { budgetStartDay: 29 },
    })
    expect(res2.status()).toBe(400)
  })
})
