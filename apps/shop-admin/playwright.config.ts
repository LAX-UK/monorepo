import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: process.env.CI ? 120_000 : 30_000,
  reporter: [["list"], ["json", { outputFile: "playwright-report/results.json" }]],
  // Same layout as Bid admin's baselines: one folder per spec, named by screen and variant.
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, threshold: 0.2 } },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }],
});
