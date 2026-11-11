import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3040";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: process.env.CI ? 90_000 : 45_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Sign-in happens once, in the setup project; the desktop project reuses the saved states and
  // the teardown project signs them out when the run ends. Specs that need a phone width resize
  // the page to 375px themselves.
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "sign-out" },
    { name: "sign-out", testMatch: /auth\.teardown\.ts/ },
    {
      name: "chromium-desktop",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
