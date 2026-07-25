# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: combobox-clear.spec.ts >> Savings Page — Combobox Clear Button >> shows X clear button when a popular bank is selected
- Location: e2e/tests/combobox-clear.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('combobox', { name: 'Select or type bank name...' })

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
            - paragraph: e2e-budget-1784994200969@test.grandwealth.app
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
              - heading [level=1]: Bank Savings
              - paragraph: Track your savings accounts
            - button [expanded]:
              - img
              - text: Record Savings
          - generic:
            - generic:
              - generic:
                - heading [level=2]: Accounts
                - img
              - generic:
                - generic: "0"
            - generic:
              - generic:
                - heading [level=2]: Total Deposits
                - img
              - generic:
                - generic: Rp 0
            - generic:
              - generic:
                - heading [level=2]: Total Withdrawals
                - img
              - generic:
                - generic: Rp 0
            - generic:
              - generic:
                - heading [level=2]: Net Savings
                - img
              - generic:
                - generic: Rp 0
                - generic: Positive
          - generic:
            - generic:
              - img
              - textbox:
                - /placeholder: Search by account name or notes...
          - generic:
            - generic:
              - heading [level=2]: Transaction History
            - generic:
              - generic:
                - paragraph: No savings records yet. Start tracking your savings!
  - region "Notifications alt+T"
  - alert
  - dialog "Record Savings Transaction" [ref=e2]:
    - heading "Record Savings Transaction" [level=2] [ref=e4]
    - generic [ref=e5]:
      - generic [ref=e6]:
        - text: Type
        - generic [ref=e7]:
          - button "Deposit" [active] [ref=e8]:
            - img
            - text: Deposit
          - button "Withdraw" [ref=e9]:
            - img
            - text: Withdraw
      - generic [ref=e10]:
        - text: Account Name
        - combobox "Account Name" [ref=e11]:
          - generic [ref=e12]: Select or type bank name...
          - generic [ref=e13]:
            - img
      - generic [ref=e14]:
        - text: Amount (Rp)
        - spinbutton "Amount (Rp)" [ref=e15]
      - generic [ref=e16]:
        - text: Date
        - textbox "Date" [ref=e17]: 2026-07-25
      - generic [ref=e18]:
        - generic [ref=e19]: Notes (optional)
        - textbox "Notes (optional)" [ref=e20]:
          - /placeholder: e.g., Monthly salary deposit
      - button "Add Record" [ref=e21]
    - button "Close" [ref=e22]:
      - img [ref=e23]
      - generic [ref=e26]: Close
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
> 13  |     await comboboxTrigger.click()
      |                           ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  88  |     await expect(page.getByText("Add Stock")).toBeVisible()
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
```