import { defineConfig } from "@playwright/test";

/**
 * GAP-49 express checkout browser gate. Runs the Shop in `next dev` against a stand-in Shop
 * Identity (e2e-express-checkout/fake-shop-identity.mjs) with SHOP_EXPRESS_CHECKOUT on, and
 * replaces Stripe.js in the browser with e2e-express-checkout/fake-stripe.js. Nothing reaches
 * Stripe and no key is needed. `EXPRESS_CHECKOUT_SCREENSHOTS=1` also writes the design
 * screenshots to docs/design/screenshots/gap-49.
 */
const FAKE_IDENTITY_PORT = 3910;
const SHOP_PORT = 3925;
const fakeIdentity = `http://127.0.0.1:${FAKE_IDENTITY_PORT}`;

export default defineConfig({
  testDir: "./e2e-express-checkout",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${SHOP_PORT}`,
    trace: "off",
    // A preinstalled Chromium can be used instead of Playwright's own download.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  webServer: [
    {
      command: "node e2e-express-checkout/fake-shop-identity.mjs",
      url: `${fakeIdentity}/health/ready`,
      env: { FAKE_SHOP_IDENTITY_PORT: String(FAKE_IDENTITY_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm exec next dev --port ${SHOP_PORT}`,
      url: `http://localhost:${SHOP_PORT}/health/live`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        SHOP_IDENTITY_BASE_URL: fakeIdentity,
        SHOP_API_BASE_URL: fakeIdentity,
        SHOP_STOREFRONT_URL: `http://localhost:${SHOP_PORT}`,
        SHOP_EXPRESS_CHECKOUT: "true",
        // A made-up publishable key: the Stripe.js stand-in never sends it anywhere.
        SHOP_STRIPE_PUBLISHABLE_KEY: "pk_test_expressCheckoutGate",
        SHOP_DEPLOY_ENV: "test",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
