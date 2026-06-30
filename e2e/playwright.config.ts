import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E configuration for GrandWealth.
 *
 * The app must be running on the BASE_URL before tests execute.
 * Use `npm run dev:e2e` to start the dev server with the test env.
 *
 * Run tests with:
 *   npm run test:e2e              (requires dev server running)
 *   npm run test:e2e:headed       (run with visible browser)
 *   npm run test:e2e:ui           (run with Playwright UI mode)
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: "auth.setup.ts",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
})
