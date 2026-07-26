import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";
const orgOnboardingEntityId = process.env.PLAYWRIGHT_ORG_ONBOARDING_ENTITY_ID ?? "";

async function clientLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(clientEmail);
  await page.getByLabel(/password/i).fill(clientPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test.describe("org onboarding wizard @journey", () => {
  test("resume path shows progress, finish later, and mobile step sheet", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");
    test.skip(
      !orgOnboardingEntityId,
      "Set PLAYWRIGHT_ORG_ONBOARDING_ENTITY_ID to an in-progress organisation",
    );

    await clientLogin(page);
    await page.goto(
      `/onboarding/organisation/step/type?entityId=${encodeURIComponent(orgOnboardingEntityId)}`,
    );

    await expect(page.getByRole("link", { name: /finish later/i })).toHaveCount(1);
    await expect(page.getByText(/Step \d+ of 5/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("navigation", { name: /form steps/i })).toBeVisible();

    await page.getByTestId("wizard-steps-menu").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/what you'll need/i)).toBeVisible();
  });

  test("blocked deep link redirects to earliest incomplete step", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");
    test.skip(
      !orgOnboardingEntityId,
      "Set PLAYWRIGHT_ORG_ONBOARDING_ENTITY_ID to an in-progress organisation",
    );

    await clientLogin(page);
    await page.goto(
      `/onboarding/organisation/step/identity?entityId=${encodeURIComponent(orgOnboardingEntityId)}`,
    );

    await expect(page).not.toHaveURL(/\/step\/identity/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/onboarding\/organisation\/step\//);
  });

  test("fresh flow starts at type step with organisation options", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!clientEmail || !clientPassword, "Set PLAYWRIGHT_CLIENT_EMAIL/PASSWORD");

    await clientLogin(page);
    await page.goto("/onboarding/organisation/step/type?fresh=1");

    await expect(page.getByRole("heading", { name: /organisation type/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/choose the category that best describes/i)).toBeVisible();
  });
});

/**
 * Env vars for this spec (also used in seller-connect.spec.ts):
 * - PLAYWRIGHT_E2E=1
 * - PLAYWRIGHT_CLIENT_EMAIL / PLAYWRIGHT_CLIENT_PASSWORD
 * - PLAYWRIGHT_ORG_ONBOARDING_ENTITY_ID — org draft the client user can resume
 */
