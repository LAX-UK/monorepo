/**
 * E2E saleroom tests require PLAYWRIGHT_BASE_URL=http://localhost:3000 (not 127.0.0.1)
 * so auth cookies match the API host. Set PLAYWRIGHT_E2E=1 and staff credentials to run.
 */
import { defineConfig } from "@playwright/test";
import { roleAuthState } from "./e2e/helpers/auth-state";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
const hasCatalogueManagerCredentials = Boolean(
  process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL &&
    process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD,
);

const chromium = {
  browserName: "chromium" as const,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
};

const roleProjects = [
  {
    name: "setup-staff",
    testMatch: /auth\.setup\.ts/,
    grep: /@setup-staff/,
    timeout: 90_000,
    use: chromium,
  },
  {
    name: "setup-buyer",
    testMatch: /auth\.setup\.ts/,
    grep: /@setup-buyer/,
    timeout: 90_000,
    use: chromium,
  },
  {
    name: "setup-finance",
    testMatch: /auth\.setup\.ts/,
    grep: /@setup-finance/,
    timeout: 90_000,
    use: chromium,
  },
  {
    name: "setup-readonly",
    testMatch: /auth\.setup\.ts/,
    grep: /@setup-readonly/,
    timeout: 90_000,
    use: chromium,
  },
  {
    name: "setup-operations",
    testMatch: /auth\.setup\.ts/,
    grep: /@setup-operations/,
    timeout: 90_000,
    use: chromium,
  },
  ...(hasCatalogueManagerCredentials
    ? [
        {
          name: "setup-catalogue",
          testMatch: /auth\.setup\.ts/,
          grep: /@setup-catalogue/,
          timeout: 90_000,
          use: chromium,
        },
      ]
    : []),
  {
    name: "staff-chromium",
    testMatch: [/admin-.*\.spec\.ts/, /saleroom-clerk\.spec\.ts/],
    testIgnore: /admin-dashboard-roles\.spec\.ts/,
    dependencies: ["setup-staff"],
    workers: 1,
    use: { ...chromium, storageState: roleAuthState.staff },
  },
  {
    name: "dashboard-roles-chromium",
    testMatch: /admin-dashboard-roles\.spec\.ts/,
    dependencies: ["setup-staff", "setup-finance", "setup-readonly", "setup-operations"],
    workers: 1,
    use: chromium,
  },
  {
    name: "buyer-chromium",
    testMatch: /buyer-.*\.spec\.ts/,
    dependencies: ["setup-buyer"],
    use: { ...chromium, storageState: roleAuthState.buyer },
  },
  ...(hasCatalogueManagerCredentials
    ? [
        {
          name: "catalogue-chromium",
          testMatch: /catalogue-manager-.*\.spec\.ts/,
          dependencies: ["setup-catalogue"],
          workers: 1,
          use: { ...chromium, storageState: roleAuthState.catalogueManager },
        },
      ]
    : []),
  {
    name: "public-chromium",
    testIgnore: [
      /auth\.setup\.ts/,
      /admin-.*\.spec\.ts/,
      /buyer-.*\.spec\.ts/,
      /catalogue-manager-.*\.spec\.ts/,
      /saleroom-clerk\.spec\.ts/,
    ],
    use: chromium,
  },
];

export default defineConfig({
  testDir: "e2e",
  reporter: process.env.CI
    ? [["blob", { outputDir: "blob-report" }]]
    : [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, threshold: 0.2 },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: e2eEnabled ? roleProjects : [{ name: "chromium", use: chromium }],
});
