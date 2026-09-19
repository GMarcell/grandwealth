import { test, expect } from "@playwright/test"

/**
 * The savings/stocks dialogs each contain one combobox trigger (a styled
 * Button with role="combobox"). Its accessible name comes from the form
 * <Label htmlFor> association ("Account Name"/"Symbol") — NOT from the
 * placeholder text shown inside it — so locators scope to the dialog's
 * combobox role and assert on visible text.
 *
 * Options are selected with the keyboard (Enter on the highlighted item):
 * clicking an option in the instant after the popover opens races its open
 * animation and the selection is silently lost, which made these tests flaky.
 */
function comboboxTrigger(page: import("@playwright/test").Page) {
  return page.getByRole("dialog").getByRole("combobox").first()
}

test.describe("Savings Page — Combobox Clear Button", () => {
  test("shows X clear button when a popular bank is selected", async ({ page }) => {
    await page.goto("/savings")

    // Open the add dialog
    await page.getByRole("button", { name: "Record Savings" }).click()
    await expect(page.getByText("Record Savings Transaction")).toBeVisible()

    // Open the combobox; "BCA" is the first (highlighted) option, so Enter selects it.
    const triggerButton = comboboxTrigger(page)
    await triggerButton.click()
    await expect(page.getByRole("option", { name: "BCA", exact: true })).toBeVisible()
    await page.keyboard.press("Enter")

    // The X clear button should now be visible on the trigger
    await expect(triggerButton).toContainText("BCA")
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

    // Open the combobox and type a custom bank name in the search input
    const triggerButton = comboboxTrigger(page)
    await triggerButton.click()
    const searchInput = page.getByPlaceholder("Search bank name...")
    await searchInput.fill("My Custom Bank")

    // The only remaining option is the custom one; Enter selects it.
    const customOption = page.getByRole("option").filter({ hasText: "My Custom Bank" })
    await expect(customOption).toBeVisible()
    await page.keyboard.press("Enter")

    // The trigger should now show the custom name
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
    const triggerButton = comboboxTrigger(page)
    await triggerButton.click()
    await expect(page.getByRole("option", { name: "BCA", exact: true })).toBeVisible()
    await page.keyboard.press("Enter")

    // Click the X to clear — the popover should NOT open
    await expect(triggerButton).toContainText("BCA")
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
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading", { name: "Add Stock" })).toBeVisible()

    // Open the symbol combobox and search for a stock
    const triggerButton = comboboxTrigger(page)
    await triggerButton.click()
    const searchInput = page.getByPlaceholder("Type company name or symbol...")
    await searchInput.fill("BBCA")

    // Wait for results, then confirm the highlighted one with Enter.
    const option = page.getByRole("option").first()
    await expect(option).toBeVisible({ timeout: 10000 })
    await page.keyboard.press("Enter")

    // The trigger should no longer show the placeholder
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
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("heading", { name: "Add Stock" })).toBeVisible()
    const triggerButton = comboboxTrigger(page)
    await triggerButton.click()

    // Search and select a stock
    const searchInput = page.getByPlaceholder("Type company name or symbol...")
    await searchInput.fill("BBCA")
    const option = page.getByRole("option").first()
    await expect(option).toBeVisible({ timeout: 10000 })
    await page.keyboard.press("Enter")

    // Click the X to clear — the popover should NOT open
    await expect(triggerButton).not.toContainText("Search stock symbol...")
    const xButton = triggerButton.locator("[role=button]")
    await xButton.click()

    // The popover content should not be visible
    await expect(page.getByPlaceholder("Type company name or symbol...")).not.toBeVisible()
  })
})
