import path from "path"
import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E configuration for GrandWealth.
 *
 * Unless BASE_URL points at a server that is already running, Playwright
 * starts `npm run dev` itself (see `webServer` below).
 *
 * Run tests with:
 *   npm run test:e2e              (starts the dev server if needed)
 *   npm run test:e2e:headed       (run with visible browser)
 *   npm run test:e2e:ui           (run with Playwright UI mode)
 */
export default defineConfig({
  testDir: "./tests",
  // Deletes every @test.grandwealth.app account after the run so repeated E2E
  // runs (which each create fresh timestamped users) don't fill the database.
  globalTeardown: path.resolve(__dirname, "global-teardown.ts"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  // Start the app automatically. Without this, `npm run test:e2e` failed with
  // connection errors unless a server happened to be running already.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
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
