import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import { openPersonal } from "./helpers/organisation-journeys";
import { PERSONAL_PAGES, expectPersonalBaselines } from "./helpers/workspace-baselines";

/**
 * A member of several organisations on their own account: the pages sit on the public site under
 * "Your account", with the same page header and lists as the workspace, and no organisation's
 * sidebar.
 */

test.describe("personal account pages @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("opens every page under Your account in the public site", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const person = await openPersonal(browser, roleAuthState.buyer, baseURL);
    const { page } = person;
    for (const path of PERSONAL_PAGES) {
      await test.step(`opens ${path}`, async () => {
        await page.goto(path);
        const subNav = page.getByRole("navigation", { name: "Your account" });
        await expect(subNav).toBeVisible();
        await expect(subNav.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByTestId("account-switcher")).toHaveCount(0);
      });
    }
    await person.close();
  });
});

test.describe("personal account baselines @a11y", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("every page under Your account passes axe in light and dark at 1440 and 375", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    await expectPersonalBaselines(browser, roleAuthState.buyer, baseURL);
  });
});
