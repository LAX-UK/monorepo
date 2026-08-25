import { expect, test } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
  gotoAdminPath,
} from "./helpers/auth";

test.describe("admin dashboard home @smoke", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("opens work inbox from home dashboard", async ({ page }) => {
    await gotoAdminPath(page, "/admin");
    await dismissStaffPaletteIfOpen(page);
    await expect(page.getByRole("heading", { name: /good day/i })).toBeVisible();
    const inboxHeading = page.getByRole("heading", { name: /work inbox/i });
    await expect(inboxHeading).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
    const firstInboxLink = page
      .getByRole("table", { name: /work inbox/i })
      .getByRole("link")
      .first();
    if (await firstInboxLink.isVisible()) {
      await firstInboxLink.click();
      await expect(page).not.toHaveURL(/\/admin$/);
    }
  });
});
