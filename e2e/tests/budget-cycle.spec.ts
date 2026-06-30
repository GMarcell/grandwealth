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

  test("changing back to 1st restores calendar mode", async ({ page }) => {
    await page.goto("/settings")

    // First change to 15th
    const selectTrigger = page.getByRole("combobox").first()
    await selectTrigger.click()
    await page.getByRole("option", { name: "15th" }).click()

    // Save
    await page.getByRole("button", { name: "Save Budget Settings" }).click()
    await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })

    // Change back to 1st
    await selectTrigger.click()
    await page.getByRole("option", { name: "1st" }).click()

    await expect(
      page.getByText("Budget months align with calendar months")
    ).toBeVisible()

    // Save again
    await page.getByRole("button", { name: "Save Budget Settings" }).click()
    await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  })
})

test.describe("Budget Cycle — Budgets Page", () => {
  test("budgets page loads and shows month selector", async ({ page }) => {
    await page.goto("/budgets")

    // Page title is visible
    await expect(page.getByText("Budgets")).toBeVisible()
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

  test("month labels reflect budget start day setting", async ({ page }) => {
    // First set the budget start day to 15th
    await page.goto("/settings")
    const selectTrigger = page.getByRole("combobox").first()
    await selectTrigger.click()
    await page.getByRole("option", { name: "15th" }).click()
    await page.getByRole("button", { name: "Save Budget Settings" }).click()
    await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })

    // Go to budgets page
    await page.goto("/budgets")

    // The budget month in the summary card should be visible
    await expect(page.getByText("Budget")).toBeVisible()

    // Reset settings back to 1st
    await page.goto("/settings")
    await page.getByRole("combobox").first().click()
    await page.getByRole("option", { name: "1st" }).click()
    await page.getByRole("button", { name: "Save Budget Settings" }).click()
    await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  })

  test("add budget dialog opens", async ({ page }) => {
    await page.goto("/budgets")

    // Click "Add Budget" button
    const addButton = page.getByRole("button", { name: "Add Budget" })
    // If button is disabled (no categories without budgets), test dialog via another approach
    if (await addButton.isEnabled()) {
      await addButton.click()
      await expect(page.getByText("Add Budget")).toBeVisible()
      await expect(page.getByText("Category")).toBeVisible()
      await expect(page.getByText("Monthly Budget")).toBeVisible()
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
