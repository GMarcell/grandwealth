import { test, expect } from "@playwright/test"

test.describe("Budgets Page — Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/budgets")
    await page.waitForLoadState("networkidle")
  })

  test("renders the budgets page with Add Budget button", async ({ page }) => {
    // Use h1 locator to avoid matching sidebar/nav elements
    await expect(page.locator("h1").filter({ hasText: "Budgets" })).toBeVisible()
    await expect(
      page.getByText("Set monthly spending limits for each expense category")
    ).toBeVisible()

    // The Add Budget button is the only button with + icon before "Add Budget"
    const addButton = page.locator("button").filter({ hasText: "Add Budget" }).first()
    await expect(addButton).toBeVisible()
  })

  test("opens the Add Budget dialog and shows form fields", async ({ page }) => {
    const addButton = page.locator("button").filter({ hasText: "Add Budget" }).first()
    // Skip if disabled (all categories already have budgets)
    test.skip(await addButton.isDisabled(), "No categories available to add budget")
    await addButton.click()

    // Dialog should appear
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Check dialog title
    await expect(dialog.locator("h2")).toContainText("Add Budget")

    // Use exact text match to avoid matching the Select placeholder "Select category"
    await expect(dialog.getByText("Category", { exact: true })).toBeVisible()
    await expect(dialog.getByText("Monthly Budget (Rp)")).toBeVisible()
  })

  test("shows validation errors when submitting empty form", async ({ page }) => {
    const addButton = page.locator("button").filter({ hasText: "Add Budget" }).first()
    test.skip(await addButton.isDisabled(), "No categories available to add budget")
    await addButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Submit the form directly (bypasses Radix UI event handling)
    await page.locator('[role="dialog"] form').evaluate(form =>
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    )

    // Validation errors should appear
    // Empty amount field triggers .min(1) which shows "Amount is required"
    await expect(page.getByText("Category is required")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Amount is required")).toBeVisible({ timeout: 5000 })
  })

  test("clears amount validation error when valid amount is entered", async ({ page }) => {
    const addButton = page.locator("button").filter({ hasText: "Add Budget" }).first()
    test.skip(await addButton.isDisabled(), "No categories available to add budget")
    await addButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Submit the form directly
    const submitForm = () =>
      page.locator('[role="dialog"] form').evaluate(form =>
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      )
    await submitForm()

    // Verify both errors appear
    // Empty amount field triggers .min(1) which shows "Amount is required"
    await expect(page.getByText("Category is required")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Amount is required")).toBeVisible({ timeout: 5000 })

    // Enter a valid amount
    const amountInput = page.getByLabel("Monthly Budget (Rp)")
    await amountInput.fill("1000000")

    // Resubmit - amount error should clear, category error remains
    await submitForm()

    await expect(page.getByText("Amount is required")).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Category is required")).toBeVisible()
  })

  test("shows error for zero amount", async ({ page }) => {
    const addButton = page.locator("button").filter({ hasText: "Add Budget" }).first()
    test.skip(await addButton.isDisabled(), "No categories available to add budget")
    await addButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Enter zero as amount
    const amountInput = page.getByLabel("Monthly Budget (Rp)")
    await amountInput.fill("0")

    // Submit the form directly
    await page.locator('[role="dialog"] form').evaluate(form =>
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    )

    // Should show positive number error
    await expect(page.getByText("Amount must be a positive number")).toBeVisible({ timeout: 5000 })
  })

  test("rollover toggle and cap are visible by default", async ({ page }) => {
    const addButton = page.locator("button").filter({ hasText: "Add Budget" }).first()
    test.skip(await addButton.isDisabled(), "No categories available to add budget")
    await addButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Rollover label should be visible
    await expect(dialog.getByText("Rollover unused budget")).toBeVisible()

    // Rollover cap input should be visible (since rollover is enabled by default)
    await expect(dialog.getByText("Max Rollover (Rp)")).toBeVisible()
  })

  test("creates a budget when valid data is submitted", async ({ page }) => {
    const addButton = page.locator("button").filter({ hasText: "Add Budget" }).first()
    test.skip(await addButton.isDisabled(), "No categories available to add budget")
    await addButton.click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // Select a category via the Radix UI Select combobox
    const categorySelect = dialog.getByRole("combobox")
    await categorySelect.click()

    // Select the first available category option
    const firstOption = page.getByRole("option").first()
    await expect(firstOption).toBeVisible({ timeout: 5000 })
    const categoryName = await firstOption.textContent()
    await firstOption.click()

    // Enter a valid amount
    const amountInput = page.getByLabel("Monthly Budget (Rp)")
    await amountInput.fill("500000")

    // Submit the form directly
    await page.locator('[role="dialog"] form').evaluate(form =>
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    )

    // Should show success toast
    await expect(page.getByText("Budget saved")).toBeVisible({ timeout: 10000 })

    // The budget should now appear in the list - use h4 heading to avoid strict mode
    if (categoryName) {
      const trimmed = categoryName.trim()
      await expect(page.locator("h4").filter({ hasText: trimmed })).toBeVisible({ timeout: 5000 })
    }
  })
})
