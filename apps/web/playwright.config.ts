/**
 * E2E saleroom tests require PLAYWRIGHT_BASE_URL=http://localhost:3000 (not 127.0.0.1)
 * so auth cookies match the API host. Set PLAYWRIGHT_E2E=1 and staff credentials to run.
 */
import { defineConfig } from "@playwright/test";
import { roleAuthState } from "./e2e/helpers/auth-state";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
const apiPort = process.env.E2E_API_PORT ?? "3001";
const webPort = process.env.E2E_WEB_PORT ?? "3000";
const hasCatalogueManagerCredentials = Boolean(
  process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL &&
    process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD,
);

const chromium = {
  browserName: "chromium" as const,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
};

/**
 * The stack is owned here rather than in CI YAML so a local run and a CI run
 * start the same processes on the same ports. `reuseExistingServer` stays true
 * even in CI: each job gets a fresh runner, and the PR gate invokes Playwright
 * twice (role setup, then the suite), so the second invocation must be able to
 * attach to a stack the first one has not finished releasing.
 */
const stackServers = [
  {
    command: "pnpm --filter @auction/api start",
    url: `http://localhost:${apiPort}/health/live`,
    // The API rejects localhost origins and short secrets under NODE_ENV=production,
    // so it runs in development. Scoped per process: `next build` needs production.
    env: { PORT: apiPort, NODE_ENV: "development" },
    reuseExistingServer: true,
    timeout: 120_000,
  },
  {
    // `next start` serves `.next/static`. The standalone server does not, unless
    // `.next/static` and `public/` are copied beside it (see apps/web/Dockerfile);
    // without them the client bundle 404s and the app never hydrates.
    command: "pnpm --filter @auction/web start",
    url: `http://localhost:${webPort}`,
    env: { PORT: webPort },
    reuseExistingServer: true,
    timeout: 120_000,
  },
];

const roleProjects = [
  {
    name: "setup-staff",
    testMatch: /auth\.setup\.ts/,
    grep: /@setup-staff/,
    timeout: 120_000,
    use: chromium,
  },
  {
    name: "setup-buyer",
    testMatch: /auth\.setup\.ts/,
    grep: /@setup-buyer/,
    timeout: 120_000,
    use: chromium,
  },
  ...(hasCatalogueManagerCredentials
    ? [
        {
          name: "setup-catalogue",
          testMatch: /auth\.setup\.ts/,
          grep: /@setup-catalogue/,
          timeout: 120_000,
          use: chromium,
        },
      ]
    : []),
  {
    name: "staff-chromium",
    testMatch: [/admin-.*\.spec\.ts/, /saleroom-clerk\.spec\.ts/],
    dependencies: ["setup-staff"],
    use: { ...chromium, storageState: roleAuthState.staff },
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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, threshold: 0.2 },
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Set PLAYWRIGHT_EXTERNAL_STACK=1 to test against an already-running stack
  // (e.g. `pnpm dev`) instead of letting Playwright start production servers.
  ...(e2eEnabled && !process.env.PLAYWRIGHT_EXTERNAL_STACK ? { webServer: stackServers } : {}),
  projects: e2eEnabled ? roleProjects : [{ name: "chromium", use: chromium }],
});
