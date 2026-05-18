/**
 * Submission wizard mobile E2E (iPhone).
 *
 * Requires:
 *   PLAYWRIGHT_E2E=1
 *   PLAYWRIGHT_BASE_URL
 *   PLAYWRIGHT_CLIENT_EMAIL / PLAYWRIGHT_CLIENT_PASSWORD
 *   Optional: PLAYWRIGHT_DRAFT_SUBMISSION_ID (UUID) — otherwise uses first draft link on list
 *
 * Run: PLAYWRIGHT_E2E=1 pnpm --filter @auction/web test:e2e -- e2e/submission-wizard-mobile.spec.ts
 */
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1 and start apps/web (pnpm dev).";

const clientEmail = process.env.PLAYWRIGHT_CLIENT_EMAIL ?? "";
const clientPassword = process.env.PLAYWRIGHT_CLIENT_PASSWORD ?? "";
const draftId = process.env.PLAYWRIGHT_DRAFT_SUBMISSION_ID ?? "";

async function clientLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(clientEmail);
  await page.getByLabel(/password/i).fill(clientPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
}

test.describe("submission wizard mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("Next on Details step advances to Photos without leaving the wizard", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      !clientEmail || !clientPassword,
      "Set PLAYWRIGHT_CLIENT_EMAIL and PLAYWRIGHT_CLIENT_PASSWORD",
    );

    await clientLogin(page);

    if (draftId) {
      await page.goto(`/dashboard/submissions/${draftId}`);
    } else {
      await page.goto("/dashboard/submissions");
      const draftLink = page.getByRole("link", { name: /draft/i }).first();
      await expect(draftLink).toBeVisible({ timeout: 15_000 });
      await draftLink.click();
      await page.waitForURL(/\/dashboard\/submissions\/[^/]+$/);
    }

    await expect(page.getByTestId("submission-wizard-step-basics")).toBeVisible({
      timeout: 15_000,
    });

    const bottomNav = page.getByRole("navigation", {
      name: /primary mobile dashboard navigation/i,
    });
    await expect(bottomNav).toHaveCount(0);

    await page.getByTestId("wizard-next").click();
    await expect(page.getByTestId("submission-wizard-step-details")).toBeVisible();

    const urlBefore = page.url();
    await page.getByTestId("wizard-next").click();

    await expect(page.getByTestId("submission-wizard-step-photos")).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByText(/draft saved/i)).not.toBeVisible();
  });
});
