import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  accountE2eEnabled,
  accountE2eSkipReason,
  collectorCredentials,
  expectPageHeading,
  signInAccount,
} from "./helpers/account-e2e";

const BLOCKING_IMPACTS = ["critical", "serious", "moderate"];

const ROUTES = [
  { path: "/account", heading: /^Welcome/ },
  { path: "/account/portfolio", heading: "Portfolio" },
  { path: "/account/portfolio/money", heading: "Money" },
] as const;

test.describe("Account accessibility @a11y", () => {
  test.beforeEach(() => {
    test.skip(!accountE2eEnabled, accountE2eSkipReason);
  });

  for (const { path, heading } of ROUTES) {
    test(`${path} has no blocking axe violations`, async ({ page }) => {
      const collector = collectorCredentials();
      test.skip(!collector, "ACCOUNT_E2E_COLLECTOR_EMAIL / _PASSWORD not set");
      if (!collector) return;
      await signInAccount(page, collector, path);
      await expectPageHeading(page, heading);
      await page.waitForLoadState("networkidle");
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(axe.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))).toEqual([]);
    });
  }
});
