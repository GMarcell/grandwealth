# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: combobox-clear.spec.ts >> Stocks Page — Combobox Clear Button >> shows X clear button when a stock is selected
- Location: e2e/tests/combobox-clear.spec.ts:83:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Add Stock')
Expected: visible
Error: strict mode violation: getByText('Add Stock') resolved to 3 elements:
    1) <button type="button" data-state="open" aria-expanded="true" aria-haspopup="dialog" aria-controls="radix-_R_a6atqbnaitmlb_" class="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow-sm hover:bg-primary/…>…</button> aka locator('main').getByText('Add Stock')
    2) <h2 id="radix-_R_a6atqbnaitmlbH1_" class="text-lg font-semibold leading-none tracking-tight">Add Stock</h2> aka getByRole('heading', { name: 'Add Stock' })
    3) <button type="submit" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.97] h-9 px-4 py-2 w-full">Add Stock</button> aka getByRole('button', { name: 'Add Stock' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Add Stock')

```

# Page snapshot

```yaml
- generic:
  - generic:
    - complementary:
      - generic:
        - generic:
          - img
          - generic: GrandWealth
      - navigation:
        - link:
          - /url: /dashboard
          - img
          - generic: Dashboard
        - link:
          - /url: /transactions
          - img
          - generic: Transactions
        - link:
          - /url: /recurring
          - img
          - generic: Recurring
        - link:
          - /url: /reports
          - img
          - generic: Reports
        - link:
          - /url: /analysis
          - img
          - generic: AI Analysis
        - link:
          - /url: /savings
          - img
          - generic: Savings
        - link:
          - /url: /goals
          - img
          - generic: Goals
        - link:
          - /url: /debts
          - img
          - generic: Debts
        - link:
          - /url: /gold
          - img
          - generic: Gold
        - link:
          - /url: /stocks
          - img
          - generic: Stocks
        - link:
          - /url: /budgets
          - img
          - generic: Budgets
        - link:
          - /url: /settings
          - img
          - generic: Settings
      - generic:
        - generic:
          - generic: E
          - generic:
            - paragraph: E2E Test User
            - paragraph: e2e-budget-1785822541395@test.grandwealth.app
        - generic:
          - button:
            - img
            - generic: Toggle theme
          - button:
            - img
    - main:
      - generic:
        - generic:
          - generic:
            - generic:
              - heading [level=1]: Stocks
              - paragraph: Track your stock portfolio
            - generic:
              - button:
                - img
                - text: Refresh Prices
              - button [expanded]:
                - img
                - text: Add Stock
          - generic:
            - generic:
              - generic:
                - heading [level=2]: Total Stocks
                - img
              - generic:
                - generic: "0"
                - paragraph: Different companies
            - generic:
              - generic:
                - heading [level=2]: Total Lots
                - img
              - generic:
                - generic: "0"
                - paragraph: 0 shares
            - generic:
              - generic:
                - heading [level=2]: Total Invested
                - img
              - generic:
                - generic: Rp 0
            - generic:
              - generic:
                - heading [level=2]: Market Value
                - img
              - generic:
                - generic: Rp 0
                - paragraph: +Rp 0 (+0.0%)
          - generic:
            - generic:
              - generic:
                - heading [level=2]:
                  - img
                  - text: Dividend Income
                - paragraph: Record dividend payouts from your holdings
              - button [disabled]:
                - img
                - text: Add Dividend
            - generic:
              - generic:
                - img
          - generic:
            - generic:
              - img
              - textbox:
                - /placeholder: Search by symbol or name...
            - paragraph: Click "Refresh Prices" to get live data
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e6] [cursor=pointer]:
    - img [ref=e7]
  - alert
  - dialog "Add Stock" [ref=e11]:
    - heading "Add Stock" [level=2] [ref=e13]
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]:
          - text: Symbol
          - combobox [active] [ref=e17]:
            - generic [ref=e18]: Search stock symbol...
            - generic [ref=e19]:
              - img
        - generic [ref=e20]:
          - text: Quantity (lots)
          - spinbutton "Quantity (lots)" [ref=e21]
          - paragraph [ref=e22]: 1 lot = 100 shares
      - generic [ref=e23]:
        - text: Company Name
        - textbox "Company Name" [ref=e24]:
          - /placeholder: e.g., Bank Central Asia Tbk.
      - generic [ref=e25]:
        - text: Buy Price per Lot (Rp)
        - spinbutton "Buy Price per Lot (Rp)" [ref=e26]
      - generic [ref=e27]:
        - text: Purchase Date
        - textbox "Purchase Date" [ref=e28]: 2026-08-04
      - generic [ref=e29]:
        - text: Notes (optional)
        - textbox "Notes (optional)" [ref=e30]:
          - /placeholder: Any notes about this purchase
      - button "Add Stock" [ref=e31]
    - button "Close" [ref=e32]:
      - img [ref=e33]
      - generic [ref=e36]: Close
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test"
  2   | 
  3   | test.describe("Savings Page — Combobox Clear Button", () => {
  4   |   test("shows X clear button when a popular bank is selected", async ({ page }) => {
  5   |     await page.goto("/savings")
  6   | 
  7   |     // Open the add dialog
  8   |     await page.getByRole("button", { name: "Record Savings" }).click()
  9   |     await expect(page.getByText("Record Savings Transaction")).toBeVisible()
  10  | 
  11  |     // Open the combobox
  12  |     const comboboxTrigger = page.getByRole("combobox", { name: "Select or type bank name..." })
  13  |     await comboboxTrigger.click()
  14  | 
  15  |     // Select "BCA" from the dropdown
  16  |     await page.getByRole("option", { name: "BCA" }).click()
  17  | 
  18  |     // The X clear button should now be visible on the trigger
  19  |     const triggerButton = page.getByRole("combobox")
  20  |     await expect(triggerButton).toContainText("BCA")
  21  | 
  22  |     // Click the X to clear
  23  |     const xButton = triggerButton.locator("[role=button]")
  24  |     await expect(xButton).toBeVisible()
  25  |     await xButton.click()
  26  | 
  27  |     // The trigger should now show the placeholder again
  28  |     await expect(triggerButton).toContainText("Select or type bank name...")
  29  |   })
  30  | 
  31  |   test("shows X clear button when a custom bank name is entered", async ({ page }) => {
  32  |     await page.goto("/savings")
  33  | 
  34  |     // Open the add dialog
  35  |     await page.getByRole("button", { name: "Record Savings" }).click()
  36  |     await expect(page.getByText("Record Savings Transaction")).toBeVisible()
  37  | 
  38  |     // Open the combobox
  39  |     const comboboxTrigger = page.getByRole("combobox", { name: "Select or type bank name..." })
  40  |     await comboboxTrigger.click()
  41  | 
  42  |     // Type a custom bank name in the search input
  43  |     const searchInput = page.getByPlaceholder("Search bank name...")
  44  |     await searchInput.fill("My Custom Bank")
  45  | 
  46  |     // Click the "Use" option to select custom
  47  |     await page.getByText('Use "My Custom Bank"').click()
  48  | 
  49  |     // The trigger should now show the custom name
  50  |     const triggerButton = page.getByRole("combobox")
  51  |     await expect(triggerButton).toContainText("My Custom Bank")
  52  | 
  53  |     // The X clear button should be visible
  54  |     const xButton = triggerButton.locator("[role=button]")
  55  |     await expect(xButton).toBeVisible()
  56  | 
  57  |     // Click the X to clear
  58  |     await xButton.click()
  59  | 
  60  |     // The trigger should now show the placeholder again
  61  |     await expect(triggerButton).toContainText("Select or type bank name...")
  62  |   })
  63  | 
  64  |   test("clear button does not open the popover", async ({ page }) => {
  65  |     await page.goto("/savings")
  66  | 
  67  |     // Open the add dialog and select a bank
  68  |     await page.getByRole("button", { name: "Record Savings" }).click()
  69  |     await page.getByRole("combobox", { name: "Select or type bank name..." }).click()
  70  |     await page.getByRole("option", { name: "BCA" }).click()
  71  | 
  72  |     // Click the X to clear — the popover should NOT open
  73  |     const triggerButton = page.getByRole("combobox")
  74  |     const xButton = triggerButton.locator("[role=button]")
  75  |     await xButton.click()
  76  | 
  77  |     // The popover content should not be visible
  78  |     await expect(page.getByPlaceholder("Search bank name...")).not.toBeVisible()
  79  |   })
  80  | })
  81  | 
  82  | test.describe("Stocks Page — Combobox Clear Button", () => {
  83  |   test("shows X clear button when a stock is selected", async ({ page }) => {
  84  |     await page.goto("/stocks")
  85  | 
  86  |     // Open the add dialog
  87  |     await page.getByRole("button", { name: "Add Stock" }).click()
> 88  |     await expect(page.getByText("Add Stock")).toBeVisible()
      |                                               ^ Error: expect(locator).toBeVisible() failed
  89  | 
  90  |     // Open the symbol combobox
  91  |     const comboboxTrigger = page.getByRole("combobox", { name: "Search stock symbol..." })
  92  |     await comboboxTrigger.click()
  93  | 
  94  |     // Type to search for a stock (need at least 2 chars)
  95  |     const searchInput = page.getByPlaceholder("Type company name or symbol...")
  96  |     await searchInput.fill("BBCA")
  97  | 
  98  |     // Wait for search results and select whatever the first result is
  99  |     const option = page.getByRole("option").first()
  100 |     await expect(option).toBeVisible({ timeout: 10000 })
  101 |     await option.click()
  102 | 
  103 |     // The trigger should no longer show the placeholder
  104 |     const triggerButton = page.getByRole("combobox")
  105 |     await expect(triggerButton).not.toContainText("Search stock symbol...")
  106 | 
  107 |     // The X clear button should be visible
  108 |     const xButton = triggerButton.locator("[role=button]")
  109 |     await expect(xButton).toBeVisible()
  110 | 
  111 |     // Click the X to clear
  112 |     await xButton.click()
  113 | 
  114 |     // The trigger should now show the placeholder again
  115 |     await expect(triggerButton).toContainText("Search stock symbol...")
  116 |   })
  117 | 
  118 |   test("clear button does not open the popover on stocks page", async ({ page }) => {
  119 |     await page.goto("/stocks")
  120 | 
  121 |     // Open the add dialog
  122 |     await page.getByRole("button", { name: "Add Stock" }).click()
  123 |     await page.getByRole("combobox", { name: "Search stock symbol..." }).click()
  124 | 
  125 |     // Search and select a stock
  126 |     const searchInput = page.getByPlaceholder("Type company name or symbol...")
  127 |     await searchInput.fill("BBCA")
  128 |     const option = page.getByRole("option").first()
  129 |     await expect(option).toBeVisible({ timeout: 10000 })
  130 |     await option.click()
  131 | 
  132 |     // Click the X to clear — the popover should NOT open
  133 |     const triggerButton = page.getByRole("combobox")
  134 |     const xButton = triggerButton.locator("[role=button]")
  135 |     await xButton.click()
  136 | 
  137 |     // The popover content should not be visible
  138 |     await expect(page.getByPlaceholder("Type company name or symbol...")).not.toBeVisible()
  139 |   })
  140 | })
  141 | 
```