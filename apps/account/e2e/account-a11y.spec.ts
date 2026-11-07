import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { accountAuthState } from "./helpers/account-auth-state";
import { collectorSkipReason, expectPageHeading } from "./helpers/account-e2e";

const skipReason = collectorSkipReason();

const BLOCKING_IMPACTS = ["critical", "serious", "moderate"];

const ROUTES = [
  { path: "/account", heading: /^Welcome/ },
  { path: "/account/portfolio", heading: "Portfolio" },
  { path: "/account/portfolio/money", heading: "Money" },
] as const;

test.describe("Account accessibility @a11y", () => {
  test.skip(skipReason !== null, skipReason ?? "");
  test.use({ storageState: accountAuthState.collector });

  for (const { path, heading } of ROUTES) {
    test(`${path} has no blocking axe violations`, async ({ page }) => {
      await page.goto(path);
      await expectPageHeading(page, heading);
      await page.waitForLoadState("networkidle");
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(axe.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""))).toEqual([]);
    });
  }
});
