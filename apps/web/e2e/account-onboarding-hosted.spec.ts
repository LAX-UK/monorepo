import { expect, test } from "@playwright/test";
import { onboardingIncompleteLogin } from "./helpers/auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

test.describe("hosted account onboarding @journey", () => {
  test("incomplete client is routed to account onboarding after login", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await onboardingIncompleteLogin(page);
    await expect(page).toHaveURL(/\/onboarding\/account/);
    await expect(
      page.getByRole("heading", { name: /finish setting up your account/i }),
    ).toBeVisible();
  });
});

test.describe("hosted step-up reauth @journey", () => {
  test("recent auth requirement starts hosted reauth login", async ({ page }) => {
    test.skip(!enabled, skipReason);
    await page.goto("/api/auth/login?intent=reauth&next=%2Fdashboard%2Fsettings");
    await page.waitForURL(/\/(oauth2\/authorize|login)/, { timeout: 30_000 });
    const hostedLogin = page.locator("#login-form");
    const hostedHeading = page.getByRole("heading", { name: /sign in/i });
    await expect(hostedLogin.or(hostedHeading).first()).toBeVisible({ timeout: 30_000 });
  });
});
