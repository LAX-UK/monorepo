import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

test.describe("two-factor auth pages", () => {
  test("two-factor sign-in step page loads", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const res = await page.goto("/login/two-factor?next=%2Fdashboard");
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: /two-step verification/i })).toBeVisible();
  });

  test("settings two-factor setup page requires auth", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.goto("/dashboard/settings/security/two-factor");
    await expect(page).toHaveURL(/login/);
  });
});
