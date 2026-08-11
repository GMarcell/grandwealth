# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: budget-cycle.spec.ts >> Budget Cycle — Budgets Page >> add budget dialog opens
- Location: e2e/tests/budget-cycle.spec.ts:147:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Add Budget')
Expected: visible
Error: strict mode violation: getByText('Add Budget') resolved to 4 elements:
    1) <button type="button" data-state="open" aria-expanded="true" aria-haspopup="dialog" aria-controls="radix-_R_e6atqbnaitmlb_" class="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow-sm hover:bg-primary/…>…</button> aka locator('main').getByText('Add Budget', { exact: true })
    2) <p class="text-xs text-muted-foreground">Click "Add Budget" to set spending limits for you…</p> aka getByText('Click "Add Budget" to set')
    3) <h2 id="radix-_R_e6atqbnaitmlbH1_" class="text-lg font-semibold leading-none tracking-tight">Add Budget</h2> aka getByRole('heading', { name: 'Add Budget' })
    4) <button type="submit" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.97] h-9 px-4 py-2 w-full">Add Budget</button> aka getByRole('button', { name: 'Add Budget' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Add Budget')

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
              - heading [level=1]: Budgets
              - paragraph: Set monthly spending limits for each expense category
            - generic:
              - combobox:
                - generic: Jul 2026
                - img
              - button:
                - img
                - text: 50/30/20
              - button [expanded]:
                - img
                - text: Add Budget
          - generic:
            - generic:
              - generic:
                - heading [level=2]: Budget
                - img
              - generic:
                - generic: Rp 0
                - paragraph: Jul 2026
            - generic:
              - generic:
                - heading [level=2]: Effective Total
                - img
              - generic:
                - generic: Rp 0
            - generic:
              - generic:
                - heading [level=2]: Remaining
                - img
              - generic:
                - generic: Rp 0
                - generic: Under Budget
          - generic:
            - generic:
              - heading [level=2]:
                - text: Budget Details
                - generic: (Jul 2026)
            - generic:
              - generic:
                - img
                - paragraph: No budgets set for Jul 2026
                - paragraph: Click "Add Budget" to set spending limits for your expense categories.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e6] [cursor=pointer]:
    - img [ref=e7]
  - alert
  - dialog "Add Budget" [ref=e11]:
    - heading "Add Budget" [level=2] [ref=e13]
    - generic [ref=e14]:
      - generic [ref=e15]:
        - text: Category
        - combobox [active] [ref=e16]:
          - generic: Select category
          - img [ref=e17]
        - combobox [ref=e19]
      - generic [ref=e20]:
        - text: Monthly Budget (Rp)
        - spinbutton "Monthly Budget (Rp)" [ref=e21]
      - generic [ref=e22]:
        - generic [ref=e23]:
          - text: Rollover unused budget
          - paragraph [ref=e24]: Carry unused amount to next month
        - switch "Rollover unused budget" [checked] [ref=e25] [cursor=pointer]
        - checkbox [checked]
      - generic [ref=e26]:
        - generic [ref=e27]: Max Rollover (Rp) (optional)
        - spinbutton "Max Rollover (Rp) (optional)" [ref=e28]
        - paragraph [ref=e29]: Maximum amount that can roll over. Leave empty for no limit.
      - button "Add Budget" [ref=e30]
    - button "Close" [ref=e31]:
      - img [ref=e32]
      - generic [ref=e35]: Close
```

# Test source

```ts
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
> 155 |       await expect(page.getByText("Add Budget")).toBeVisible()
      |                                                  ^ Error: expect(locator).toBeVisible() failed
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
  203 |     const res2 = await request.patch("/api/user/budget-settings", {
  204 |       data: { budgetStartDay: 29 },
  205 |     })
  206 |     expect(res2.status()).toBe(400)
  207 |   })
  208 | })
  209 | 
```