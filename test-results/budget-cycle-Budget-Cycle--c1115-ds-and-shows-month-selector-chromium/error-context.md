# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: budget-cycle.spec.ts >> Budget Cycle — Budgets Page >> budgets page loads and shows month selector
- Location: e2e/tests/budget-cycle.spec.ts:98:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Budgets')
Expected: visible
Error: strict mode violation: getByText('Budgets') resolved to 2 elements:
    1) <span class="flex-1">Budgets</span> aka getByRole('link', { name: 'Budgets' })
    2) <h1 class="text-2xl font-bold tracking-tight">Budgets</h1> aka getByRole('heading', { name: 'Budgets' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Budgets')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
          - generic [ref=e80]: U
          - generic [ref=e81]:
            - paragraph [ref=e82]: User
            - paragraph
        - generic [ref=e83]:
          - button "Toggle theme" [ref=e84]:
            - img
            - generic [ref=e85]: Toggle theme
          - button "Sign out" [ref=e86]:
            - img
    - main [ref=e87]:
      - generic [ref=e89]:
        - generic [ref=e90]:
          - generic [ref=e91]:
            - heading "Budgets" [level=1] [ref=e92]
            - paragraph [ref=e93]: Set monthly spending limits for each expense category
          - generic [ref=e94]:
            - combobox [ref=e95]:
              - img [ref=e96]
            - combobox [ref=e98]
            - button "50/30/20" [ref=e99]:
              - img
              - text: 50/30/20
            - button "Add Budget" [ref=e100]:
              - img
              - text: Add Budget
        - generic [ref=e101]:
          - generic [ref=e102]:
            - generic [ref=e103]:
              - heading "Budget" [level=2] [ref=e104]
              - img [ref=e105]
            - generic [ref=e108]:
              - generic [ref=e109]: Rp 0
              - paragraph [ref=e110]: Aug 2026
          - generic [ref=e111]:
            - generic [ref=e112]:
              - heading "Effective Total" [level=2] [ref=e113]
              - img [ref=e114]
            - generic [ref=e118]: Rp 0
          - generic [ref=e119]:
            - generic [ref=e120]:
              - heading "Remaining" [level=2] [ref=e121]
              - img [ref=e122]
            - generic [ref=e125]:
              - generic [ref=e126]: Rp 0
              - generic [ref=e127]: Under Budget
        - generic [ref=e129]:
          - heading "Rollover History" [level=2] [ref=e130]:
            - img [ref=e131]
            - text: Rollover History
          - paragraph [ref=e134]: How unused budget rolled over month to month for each category
        - heading "Budget Details (Aug 2026)" [level=2] [ref=e143]:
          - text: Budget Details
          - generic [ref=e144]: (Aug 2026)
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e154] [cursor=pointer]:
    - img [ref=e155]
  - alert [ref=e158]
```

# Test source

```ts
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
  80  |     await page.getByRole("button", { name: "Save Budget Settings" }).click()
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
> 102 |     await expect(page.getByText("Budgets")).toBeVisible()
      |                                             ^ Error: expect(locator).toBeVisible() failed
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
  181 |     })
  182 |     expect(res1.ok()).toBeTruthy()
  183 |     const data1 = await res1.json()
  184 |     expect(data1.budgetStartDay).toBe(15)
  185 | 
  186 |     // Verify it persisted
  187 |     const res2 = await request.get("/api/user/budget-settings")
  188 |     const data2 = await res2.json()
  189 |     expect(data2.budgetStartDay).toBe(15)
  190 | 
  191 |     // Reset to 1
  192 |     await request.patch("/api/user/budget-settings", {
  193 |       data: { budgetStartDay: 1 },
  194 |     })
  195 |   })
  196 | 
  197 |   test("PATCH with invalid start day returns 400", async ({ request }) => {
  198 |     const res = await request.patch("/api/user/budget-settings", {
  199 |       data: { budgetStartDay: 0 },
  200 |     })
  201 |     expect(res.status()).toBe(400)
  202 | 
```