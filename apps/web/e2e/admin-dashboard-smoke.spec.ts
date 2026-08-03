import { expect, test } from "@playwright/test";
import {
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
  staffLogin,
} from "./helpers/auth";

test.describe("admin dashboard home @smoke", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("opens work inbox from home dashboard", async ({ page }) => {
    await staffLogin(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /your dashboard/i })).toBeVisible();
    const inboxHeading = page.getByRole("heading", { name: /work inbox/i });
    await expect(inboxHeading).toBeVisible();
    const firstInboxLink = page
      .getByRole("table", { name: /work inbox/i })
      .getByRole("link")
      .first();
    if (await firstInboxLink.isVisible()) {
      await firstInboxLink.click();
      await expect(page).not.toHaveURL(/\/admin$/);
    }
    await expectNoSeriousAxeViolationsInMain(page);
  });
});
