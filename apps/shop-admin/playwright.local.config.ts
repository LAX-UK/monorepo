import { defineConfig, devices } from "@playwright/test";

/** Local-only runs against scripts/local/start-shop-admin.sh; staging acceptance uses playwright.config.ts. */
export default defineConfig({
  testDir: "./e2e/local",
  testMatch: /.*\.setup\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"]],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030" },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }],
});
