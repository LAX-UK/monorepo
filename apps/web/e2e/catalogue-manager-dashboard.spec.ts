import { expect, test } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  expectNoSeriousAxeViolationsInMain,
} from "./helpers/auth";

test.describe("catalogue manager dashboard @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("shows the catalogue work inbox and submissions action", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    if (/\/login(?:\?|$)/.test(page.url())) {
      const continueLink = page
        .getByRole("link", { name: /^continue(?: to dashboard)?$/i })
        .first();
      if (await continueLink.isVisible().catch(() => false)) {
        await continueLink.click({ timeout: 5_000 });
        await page.waitForURL(/\/(admin|dashboard)/, {
          timeout: 15_000,
          waitUntil: "domcontentloaded",
        });
        await page.goto("/admin", { waitUntil: "domcontentloaded" });
      }
    }
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
