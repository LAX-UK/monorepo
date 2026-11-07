import { expect, test } from "@playwright/test";
import { accountAuthState } from "./helpers/account-auth-state";
import { collectorSkipReason, expectPageHeading, trackConsoleErrors } from "./helpers/account-e2e";

const skipReason = collectorSkipReason();

const PAGES = [
  { path: "/account/profile", heading: "Personal details" },
  { path: "/account/security", heading: "Security" },
  { path: "/account/alerts", heading: "Email alerts" },
  { path: "/account/privacy", heading: "Privacy" },
  { path: "/account/help", heading: "Help" },
] as const;

test.describe("Account settings pages @smoke", () => {
  test.skip(skipReason !== null, skipReason ?? "");
  test.use({ storageState: accountAuthState.collector });

  for (const { path, heading } of PAGES) {
    test(`${path} loads with its heading and no console errors`, async ({ page }) => {
      const consoleErrors = trackConsoleErrors(page);
      await page.goto(path);
      await expectPageHeading(page, heading);
      await page.waitForLoadState("networkidle");
      expect(consoleErrors()).toEqual([]);
    });
  }
});
