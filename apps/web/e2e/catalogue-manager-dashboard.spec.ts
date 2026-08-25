import { expect, test } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
  gotoAdminPath,
} from "./helpers/auth";

test.describe("catalogue manager dashboard @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("shows the catalogue work inbox and submissions action", async ({ page }) => {
    await gotoAdminPath(page, "/admin");
    await dismissStaffPaletteIfOpen(page);
    await expect(page.getByRole("heading", { name: /good day/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.locator("#main-content").getByRole("link", { name: /^submissions$/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /work inbox/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
  });
});
