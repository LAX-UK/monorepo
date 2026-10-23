import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

test.describe("two-factor auth pages @journey", () => {
  test("two-factor sign-in entry reaches hosted issuer chrome", async ({ page }) => {
    test.skip(!enabled, skipReason);
    const res = await page.goto("/login/two-factor?next=%2Fdashboard");
    expect(res?.ok()).toBeTruthy();
    await page.waitForURL(/\/(two-factor|login|oauth2\/authorize)/, { timeout: 30_000 });
    const hostedTwoFactor = page.getByRole("heading", {
      name: /two-step verification|authenticator/i,
    });
    await expect(hostedTwoFactor).toBeVisible({ timeout: 30_000 });
  });

  test("the old Bid two-factor settings address permanently moves to LAX Account", async ({
    request,
  }) => {
    test.skip(!enabled, skipReason);
    const res = await request.get("/dashboard/settings/security/two-factor", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toMatch(/\/account\/security$/);
  });
});
