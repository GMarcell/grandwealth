import { test, expect } from "@playwright/test"

test.describe("Savings Page — Combobox Clear Button", () => {
  test("shows X clear button when a popular bank is selected", async ({ page }) => {
    await page.goto("/savings")

    // Open the add dialog
    await page.getByRole("button", { name: "Record Savings" }).click()
    await expect(page.getByText("Record Savings Transaction")).toBeVisible()

    // Open the combobox
    const comboboxTrigger = page.getByRole("combobox", { name: "Select or type bank name..." })
    await comboboxTrigger.click()

    // Select "BCA" from the dropdown
    await page.getByRole("option", { name: "BCA" }).click()

    // The X clear button should now be visible on the trigger
    const triggerButton = page.getByRole("combobox")
    await expect(triggerButton).toContainText("BCA")

    // Click the X to clear
    const xButton = triggerButton.locator("[role=button]")
    await expect(xButton).toBeVisible()
    await xButton.click()

    // The trigger should now show the placeholder again
    await expect(triggerButton).toContainText("Select or type bank name...")
  })

  test("shows X clear button when a custom bank name is entered", async ({ page }) => {
    await page.goto("/savings")

    // Open the add dialog
    await page.getByRole("button", { name: "Record Savings" }).click()
    await expect(page.getByText("Record Savings Transaction")).toBeVisible()

    // Open the combobox
    const comboboxTrigger = page.getByRole("combobox", { name: "Select or type bank name..." })
    await comboboxTrigger.click()

    // Type a custom bank name in the search input
    const searchInput = page.getByPlaceholder("Search bank name...")
    await searchInput.fill("My Custom Bank")

    // Click the "Use" option to select custom
    await page.getByText('Use "My Custom Bank"').click()

    // The trigger should now show the custom name
    const triggerButton = page.getByRole("combobox")
    await expect(triggerButton).toContainText("My Custom Bank")

    // The X clear button should be visible
    const xButton = triggerButton.locator("[role=button]")
    await expect(xButton).toBeVisible()

    // Click the X to clear
    await xButton.click()

    // The trigger should now show the placeholder again
    await expect(triggerButton).toContainText("Select or type bank name...")
  })

  test("clear button does not open the popover", async ({ page }) => {
    await page.goto("/savings")

    // Open the add dialog and select a bank
    await page.getByRole("button", { name: "Record Savings" }).click()
    await page.getByRole("combobox", { name: "Select or type bank name..." }).click()
    await page.getByRole("option", { name: "BCA" }).click()

    // Click the X to clear — the popover should NOT open
    const triggerButton = page.getByRole("combobox")
    const xButton = triggerButton.locator("[role=button]")
    await xButton.click()

    // The popover content should not be visible
    await expect(page.getByPlaceholder("Search bank name...")).not.toBeVisible()
  })
})

test.describe("Stocks Page — Combobox Clear Button", () => {
  test("shows X clear button when a stock is selected", async ({ page }) => {
    await page.goto("/stocks")

    // Open the add dialog
    await page.getByRole("button", { name: "Add Stock" }).click()
    await expect(page.getByText("Add Stock")).toBeVisible()

    // Open the symbol combobox
    const comboboxTrigger = page.getByRole("combobox", { name: "Search stock symbol..." })
    await comboboxTrigger.click()

    // Type to search for a stock (need at least 2 chars)
    const searchInput = page.getByPlaceholder("Type company name or symbol...")
    await searchInput.fill("BBCA")

    // Wait for search results and select whatever the first result is
    const option = page.getByRole("option").first()
    await expect(option).toBeVisible({ timeout: 10000 })
    await option.click()

    // The trigger should no longer show the placeholder
    const triggerButton = page.getByRole("combobox")
    await expect(triggerButton).not.toContainText("Search stock symbol...")

    // The X clear button should be visible
    const xButton = triggerButton.locator("[role=button]")
    await expect(xButton).toBeVisible()

    // Click the X to clear
    await xButton.click()

    // The trigger should now show the placeholder again
    await expect(triggerButton).toContainText("Search stock symbol...")
  })

  test("clear button does not open the popover on stocks page", async ({ page }) => {
    await page.goto("/stocks")

    // Open the add dialog
    await page.getByRole("button", { name: "Add Stock" }).click()
    await page.getByRole("combobox", { name: "Search stock symbol..." }).click()

    // Search and select a stock
    const searchInput = page.getByPlaceholder("Type company name or symbol...")
    await searchInput.fill("BBCA")
    const option = page.getByRole("option").first()
    await expect(option).toBeVisible({ timeout: 10000 })
    await option.click()

    // Click the X to clear — the popover should NOT open
    const triggerButton = page.getByRole("combobox")
    const xButton = triggerButton.locator("[role=button]")
    await xButton.click()

    // The popover content should not be visible
    await expect(page.getByPlaceholder("Type company name or symbol...")).not.toBeVisible()
  })
})
