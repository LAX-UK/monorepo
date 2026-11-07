import { expect, test } from "@playwright/test";
import {
  accountE2eEnabled,
  accountE2eSkipReason,
  collectorCredentials,
  expectPageHeading,
  signInAccount,
  trackConsoleErrors,
} from "./helpers/account-e2e";

const PAGES = [
  { path: "/account/profile", heading: "Personal details" },
  { path: "/account/security", heading: "Security" },
  { path: "/account/alerts", heading: "Email alerts" },
  { path: "/account/privacy", heading: "Privacy" },
  { path: "/account/help", heading: "Help" },
] as const;

test.describe("Account settings pages @smoke", () => {
  test.beforeEach(() => {
    test.skip(!accountE2eEnabled, accountE2eSkipReason);
  });

  for (const { path, heading } of PAGES) {
    test(`${path} loads with its heading and no console errors`, async ({ page }) => {
      const collector = collectorCredentials();
      test.skip(!collector, "ACCOUNT_E2E_COLLECTOR_EMAIL / _PASSWORD not set");
      if (!collector) return;
      const consoleErrors = trackConsoleErrors(page);
      await signInAccount(page, collector, path);
      await expectPageHeading(page, heading);
      await page.waitForLoadState("networkidle");
      expect(consoleErrors()).toEqual([]);
    });
  }
});
