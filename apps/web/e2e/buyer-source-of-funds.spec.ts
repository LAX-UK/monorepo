import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, expectNoSeriousAxeViolationsInMain } from "./helpers/auth";

test.describe("buyer source of funds @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("exposes progress landmarks without serious violations", async ({ page }) => {
    await page.goto("/dashboard/compliance/source-of-funds");
    if (!page.url().includes("/dashboard/compliance/source-of-funds")) {
      test.skip(true, "Buyer has no active Source of Funds case in this environment");
    }

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /source of funds verification/i }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: /verification progress/i })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
    await expectNoSeriousAxeViolationsInMain(page);
  });
});
