# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: budget-cycle.spec.ts >> Budget Cycle — Settings >> changing back to 1st restores calendar mode
- Location: e2e/tests/budget-cycle.spec.ts:71:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Save Budget Settings' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e5]:
        - img [ref=e6]
        - generic [ref=e9]: GrandWealth
      - navigation [ref=e10]:
        - link "Dashboard" [ref=e11] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e12]
          - generic [ref=e17]: Dashboard
        - link "Transactions" [ref=e18] [cursor=pointer]:
          - /url: /transactions
          - img [ref=e19]
          - generic [ref=e22]: Transactions
        - link "Recurring" [ref=e23] [cursor=pointer]:
          - /url: /recurring
          - img [ref=e24]
          - generic [ref=e29]: Recurring
        - link "Reports" [ref=e30] [cursor=pointer]:
          - /url: /reports
          - img [ref=e31]
          - generic [ref=e33]: Reports
        - link "AI Analysis" [ref=e34] [cursor=pointer]:
          - /url: /analysis
          - img [ref=e35]
          - generic [ref=e43]: AI Analysis
        - link "Savings" [ref=e44] [cursor=pointer]:
          - /url: /savings
          - img [ref=e45]
          - generic [ref=e47]: Savings
        - link "Goals" [ref=e48] [cursor=pointer]:
          - /url: /goals
          - img [ref=e49]
          - generic [ref=e53]: Goals
        - link "Debts" [ref=e54] [cursor=pointer]:
          - /url: /debts
          - img [ref=e55]
          - generic [ref=e57]: Debts
        - link "Gold" [ref=e58] [cursor=pointer]:
          - /url: /gold
          - img [ref=e59]
          - generic [ref=e62]: Gold
        - link "Stocks" [ref=e63] [cursor=pointer]:
          - /url: /stocks
          - img [ref=e64]
          - generic [ref=e67]: Stocks
        - link "Budgets" [ref=e68] [cursor=pointer]:
          - /url: /budgets
          - img [ref=e69]
          - generic [ref=e72]: Budgets
        - link "Settings" [ref=e73] [cursor=pointer]:
          - /url: /settings
          - img [ref=e74]
          - generic [ref=e77]: Settings
      - generic [ref=e78]:
        - generic [ref=e79]:
          - generic [ref=e80]: E
          - generic [ref=e81]:
            - paragraph [ref=e82]: E2E Test User
            - paragraph [ref=e83]: e2e-budget-1785822541395@test.grandwealth.app
        - generic [ref=e84]:
          - button "Toggle theme" [ref=e85]:
            - img
            - generic [ref=e86]: Toggle theme
          - button "Sign out" [ref=e87]:
            - img
    - main [ref=e88]:
      - generic [ref=e90]:
        - generic [ref=e91]:
          - heading "Settings" [level=1] [ref=e92]
          - paragraph [ref=e93]: Manage your account and preferences
        - generic [ref=e94]:
          - generic [ref=e95]:
            - heading "Account" [level=2] [ref=e96]:
              - img [ref=e97]
              - text: Account
            - generic [ref=e100]: Your account information
          - generic [ref=e102]:
            - generic [ref=e103]: E
            - generic [ref=e104]:
              - paragraph [ref=e105]: E2E Test User
              - generic [ref=e106]:
                - img [ref=e107]
                - text: e2e-budget-1785822541395@test.grandwealth.app
        - generic [ref=e110]:
          - generic [ref=e111]:
            - heading "Budget Cycle" [level=2] [ref=e112]:
              - img [ref=e113]
              - text: Budget Cycle
            - generic [ref=e115]: "Set the day your budget month starts (default: 1st)"
          - generic [ref=e116]:
            - generic [ref=e117]:
              - text: Budget Month Starts On
              - generic [ref=e118]:
                - combobox [active] [ref=e119]:
                  - generic: 15th
                  - img [ref=e120]
                - paragraph [ref=e122]: Budget months run from the 15th to the 14st of the next month
            - paragraph [ref=e124]: "Example: With this setting, Aug 2026 (15 Aug - 14 Sep 2026)"
        - generic [ref=e125]:
          - generic [ref=e126]:
            - heading "Appearance" [level=2] [ref=e127]:
              - img [ref=e128]
              - text: Appearance
            - generic [ref=e134]: Customize your display settings
          - generic [ref=e136]:
            - button "Light" [ref=e137]:
              - img
              - text: Light
            - button "Dark" [ref=e138]:
              - img
              - text: Dark
            - button "System" [ref=e139]:
              - img
              - text: System
        - generic [ref=e140]:
          - generic [ref=e141]:
            - generic [ref=e142]:
              - heading "Custom Categories" [level=2] [ref=e143]:
                - img [ref=e144]
                - text: Custom Categories
              - generic [ref=e147]: Create your own income and expense categories beyond the defaults
            - button "New Category" [ref=e148]:
              - img
              - text: New Category
          - generic [ref=e149]:
            - generic [ref=e150]:
              - heading "Expense Categories" [level=4] [ref=e151]:
                - img [ref=e152]
                - text: Expense Categories
              - generic [ref=e155]:
                - generic [ref=e156]:
                  - generic [ref=e157]: FOOD
                  - combobox [ref=e158]:
                    - generic: 50/30/20
                    - img [ref=e159]
                - generic [ref=e161]:
                  - generic [ref=e162]: TRANSPORTATION
                  - combobox [ref=e163]:
                    - generic: 50/30/20
                    - img [ref=e164]
                - generic [ref=e166]:
                  - generic [ref=e167]: HOUSING
                  - combobox [ref=e168]:
                    - generic: 50/30/20
                    - img [ref=e169]
                - generic [ref=e171]:
                  - generic [ref=e172]: UTILITIES
                  - combobox [ref=e173]:
                    - generic: 50/30/20
                    - img [ref=e174]
                - generic [ref=e176]:
                  - generic [ref=e177]: HEALTHCARE
                  - combobox [ref=e178]:
                    - generic: 50/30/20
                    - img [ref=e179]
                - generic [ref=e181]:
                  - generic [ref=e182]: EDUCATION
                  - combobox [ref=e183]:
                    - generic: 50/30/20
                    - img [ref=e184]
                - generic [ref=e186]:
                  - generic [ref=e187]: ENTERTAINMENT
                  - combobox [ref=e188]:
                    - generic: 50/30/20
                    - img [ref=e189]
                - generic [ref=e191]:
                  - generic [ref=e192]: SHOPPING
                  - combobox [ref=e193]:
                    - generic: 50/30/20
                    - img [ref=e194]
                - generic [ref=e196]:
                  - generic [ref=e197]: TRAVEL
                  - combobox [ref=e198]:
                    - generic: 50/30/20
                    - img [ref=e199]
                - generic [ref=e201]:
                  - generic [ref=e202]: INSURANCE
                  - combobox [ref=e203]:
                    - generic: 50/30/20
                    - img [ref=e204]
                - generic [ref=e206]:
                  - generic [ref=e207]: TAX
                  - combobox [ref=e208]:
                    - generic: 50/30/20
                    - img [ref=e209]
                - generic [ref=e211]:
                  - generic [ref=e212]: SUBSCRIPTION
                  - combobox [ref=e213]:
                    - generic: 50/30/20
                    - img [ref=e214]
                - generic [ref=e216]:
                  - generic [ref=e217]: OTHER EXPENSE
                  - combobox [ref=e218]:
                    - generic: 50/30/20
                    - img [ref=e219]
            - generic [ref=e221]:
              - heading "Income Categories" [level=4] [ref=e222]:
                - img [ref=e223]
                - text: Income Categories
              - generic [ref=e226]:
                - generic [ref=e227]:
                  - generic [ref=e228]: SALARY
                  - combobox [ref=e229]:
                    - generic: 50/30/20
                    - img [ref=e230]
                - generic [ref=e232]:
                  - generic [ref=e233]: FREELANCE
                  - combobox [ref=e234]:
                    - generic: 50/30/20
                    - img [ref=e235]
                - generic [ref=e237]:
                  - generic [ref=e238]: BUSINESS
                  - combobox [ref=e239]:
                    - generic: 50/30/20
                    - img [ref=e240]
                - generic [ref=e242]:
                  - generic [ref=e243]: INVESTMENT
                  - combobox [ref=e244]:
                    - generic: 50/30/20
                    - img [ref=e245]
                - generic [ref=e247]:
                  - generic [ref=e248]: DIVIDEND
                  - combobox [ref=e249]:
                    - generic: 50/30/20
                    - img [ref=e250]
                - generic [ref=e252]:
                  - generic [ref=e253]: INTEREST
                  - combobox [ref=e254]:
                    - generic: 50/30/20
                    - img [ref=e255]
                - generic [ref=e257]:
                  - generic [ref=e258]: RENTAL
                  - combobox [ref=e259]:
                    - generic: 50/30/20
                    - img [ref=e260]
                - generic [ref=e262]:
                  - generic [ref=e263]: GIFT
                  - combobox [ref=e264]:
                    - generic: 50/30/20
                    - img [ref=e265]
                - generic [ref=e267]:
                  - generic [ref=e268]: REFUND
                  - combobox [ref=e269]:
                    - generic: 50/30/20
                    - img [ref=e270]
                - generic [ref=e272]:
                  - generic [ref=e273]: OTHER INCOME
                  - combobox [ref=e274]:
                    - generic: 50/30/20
                    - img [ref=e275]
        - generic [ref=e277]:
          - generic [ref=e278]:
            - heading "Danger Zone" [level=2] [ref=e279]:
              - img [ref=e280]
              - text: Danger Zone
            - generic [ref=e282]: Irreversible actions that affect your account
          - generic [ref=e284]:
            - generic [ref=e285]:
              - paragraph [ref=e286]: Delete Account
              - paragraph [ref=e287]: Permanently delete your account and all associated data — transactions, categories, budgets, gold holdings, stocks, recurring transactions, and bank savings. This action cannot be undone.
            - button "Delete My Account" [ref=e288]:
              - img
              - text: Delete My Account
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e294] [cursor=pointer]:
    - img [ref=e295]
  - alert [ref=e298]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test"
  2   | 
  3   | // Storage state is set in playwright.config.ts via the chromium project
  4   | 
  5   | test.describe("Budget Cycle — Settings", () => {
  6   |   test("shows budget cycle card on settings page", async ({ page }) => {
  7   |     await page.goto("/settings")
  8   | 
  9   |     // Budget Cycle card is visible
  10  |     await expect(page.getByText("Budget Cycle")).toBeVisible()
  11  |     await expect(
  12  |       page.getByText("Set the day your budget month starts")
  13  |     ).toBeVisible()
  14  |   })
  15  | 
  16  |   test("defaults to 1st (calendar months)", async ({ page }) => {
  17  |     await page.goto("/settings")
  18  | 
  19  |     const select = page.locator(
  20  |       'select[role="combobox"]'
  21  |     ).first()
  22  |     // The select for start day should show "1st"
  23  |     await expect(page.getByText("1st")).toBeVisible()
  24  |     await expect(
  25  |       page.getByText("Budget months align with calendar months")
  26  |     ).toBeVisible()
  27  |   })
  28  | 
  29  |   test("changing to 15th shows the updated description and save button", async ({
  30  |     page,
  31  |   }) => {
  32  |     await page.goto("/settings")
  33  | 
  34  |     // Open the start day select
  35  |     const selectTrigger = page.getByRole("combobox").first()
  36  |     await selectTrigger.click()
  37  | 
  38  |     // Select "15th"
  39  |     await page.getByRole("option", { name: "15th" }).click()
  40  | 
  41  |     // Verify the description updates
  42  |     await expect(
  43  |       page.getByText("budget months run from the 15th")
  44  |     ).toBeVisible()
  45  | 
  46  |     // Save button should appear
  47  |     const saveButton = page.getByRole("button", { name: "Save Budget Settings" })
  48  |     await expect(saveButton).toBeVisible()
  49  | 
  50  |     // Click save
  51  |     await saveButton.click()
  52  | 
  53  |     // Wait for success toast
  54  |     await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  55  |   })
  56  | 
  57  |   test("shows example date range when start day > 1", async ({ page }) => {
  58  |     await page.goto("/settings")
  59  | 
  60  |     // Change to 15th
  61  |     const selectTrigger = page.getByRole("combobox").first()
  62  |     await selectTrigger.click()
  63  |     await page.getByRole("option", { name: "15th" }).click()
  64  | 
  65  |     // Example range should appear
  66  |     await expect(
  67  |       page.getByText(/Budget months run from the 15th/)
  68  |     ).toBeVisible()
  69  |   })
  70  | 
  71  |   test("changing back to 1st restores calendar mode", async ({ page }) => {
  72  |     await page.goto("/settings")
  73  | 
  74  |     // First change to 15th
  75  |     const selectTrigger = page.getByRole("combobox").first()
  76  |     await selectTrigger.click()
  77  |     await page.getByRole("option", { name: "15th" }).click()
  78  | 
  79  |     // Save
> 80  |     await page.getByRole("button", { name: "Save Budget Settings" }).click()
      |                                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  81  |     await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  82  | 
  83  |     // Change back to 1st
  84  |     await selectTrigger.click()
  85  |     await page.getByRole("option", { name: "1st" }).click()
  86  | 
  87  |     await expect(
  88  |       page.getByText("Budget months align with calendar months")
  89  |     ).toBeVisible()
  90  | 
  91  |     // Save again
  92  |     await page.getByRole("button", { name: "Save Budget Settings" }).click()
  93  |     await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  94  |   })
  95  | })
  96  | 
  97  | test.describe("Budget Cycle — Budgets Page", () => {
  98  |   test("budgets page loads and shows month selector", async ({ page }) => {
  99  |     await page.goto("/budgets")
  100 | 
  101 |     // Page title is visible
  102 |     await expect(page.getByText("Budgets")).toBeVisible()
  103 |     await expect(
  104 |       page.getByText("Set monthly spending limits")
  105 |     ).toBeVisible()
  106 | 
  107 |     // Month selector is present
  108 |     await expect(page.getByRole("combobox").first()).toBeVisible()
  109 |   })
  110 | 
  111 |   test("month selector has 12 months listed", async ({ page }) => {
  112 |     await page.goto("/budgets")
  113 | 
  114 |     // Open the month selector
  115 |     const monthSelect = page.getByRole("combobox").first()
  116 |     await monthSelect.click()
  117 | 
  118 |     // Verify multiple months are listed (should show Dec, Nov, Oct, etc.)
  119 |     const options = page.getByRole("option")
  120 |     // At minimum the current month should be in the list
  121 |     await expect(options.first()).toBeVisible()
  122 |   })
  123 | 
  124 |   test("month labels reflect budget start day setting", async ({ page }) => {
  125 |     // First set the budget start day to 15th
  126 |     await page.goto("/settings")
  127 |     const selectTrigger = page.getByRole("combobox").first()
  128 |     await selectTrigger.click()
  129 |     await page.getByRole("option", { name: "15th" }).click()
  130 |     await page.getByRole("button", { name: "Save Budget Settings" }).click()
  131 |     await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  132 | 
  133 |     // Go to budgets page
  134 |     await page.goto("/budgets")
  135 | 
  136 |     // The budget month in the summary card should be visible
  137 |     await expect(page.getByText("Budget")).toBeVisible()
  138 | 
  139 |     // Reset settings back to 1st
  140 |     await page.goto("/settings")
  141 |     await page.getByRole("combobox").first().click()
  142 |     await page.getByRole("option", { name: "1st" }).click()
  143 |     await page.getByRole("button", { name: "Save Budget Settings" }).click()
  144 |     await expect(page.getByText("Budget settings updated")).toBeVisible({ timeout: 10000 })
  145 |   })
  146 | 
  147 |   test("add budget dialog opens", async ({ page }) => {
  148 |     await page.goto("/budgets")
  149 | 
  150 |     // Click "Add Budget" button
  151 |     const addButton = page.getByRole("button", { name: "Add Budget" })
  152 |     // If button is disabled (no categories without budgets), test dialog via another approach
  153 |     if (await addButton.isEnabled()) {
  154 |       await addButton.click()
  155 |       await expect(page.getByText("Add Budget")).toBeVisible()
  156 |       await expect(page.getByText("Category")).toBeVisible()
  157 |       await expect(page.getByText("Monthly Budget")).toBeVisible()
  158 |     }
  159 |   })
  160 | })
  161 | 
  162 | test.describe("Budget Cycle — API", () => {
  163 |   test("GET /api/user/budget-settings returns default value", async ({
  164 |     request,
  165 |   }) => {
  166 |     const res = await request.get("/api/user/budget-settings")
  167 |     expect(res.ok()).toBeTruthy()
  168 |     const data = await res.json()
  169 |     expect(data).toHaveProperty("budgetStartDay")
  170 |     expect(typeof data.budgetStartDay).toBe("number")
  171 |     expect(data.budgetStartDay).toBeGreaterThanOrEqual(1)
  172 |     expect(data.budgetStartDay).toBeLessThanOrEqual(28)
  173 |   })
  174 | 
  175 |   test("PATCH /api/user/budget-settings updates start day", async ({
  176 |     request,
  177 |   }) => {
  178 |     // Set to 15
  179 |     const res1 = await request.patch("/api/user/budget-settings", {
  180 |       data: { budgetStartDay: 15 },
```