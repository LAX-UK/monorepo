import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, seed a live lot, and start apps/web + apps/api.";

/** Optional: PLAYWRIGHT_LIVE_LOT_PATH=/lot/slug/uuid for a known active English lot. */
const liveLotPath = process.env.PLAYWRIGHT_LIVE_LOT_PATH ?? "/search";

test.describe("buyer bid flow", () => {
  test("authenticated buyer can review and confirm a bid on a live lot", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.PLAYWRIGHT_BUYER_EMAIL ?? "buyer@lax.bid");
    await page.getByLabel(/password/i).fill(process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/dashboard|lot|search|sales/, { timeout: 20_000 });

    await page.goto(liveLotPath);
    await page.waitForLoadState("networkidle");

    const reviewButton = page.getByRole("button", { name: /review bid/i }).first();
    if (!(await reviewButton.isVisible().catch(() => false))) {
      test.skip(true, "No review bid control — set PLAYWRIGHT_LIVE_LOT_PATH to an active lot.");
    }

    await reviewButton.click();
    await expect(page.getByRole("button", { name: /place bid/i })).toBeVisible();
    await page.getByRole("button", { name: /place bid/i }).click();

    await expect(page.getByText(/bid placed successfully/i)).toBeVisible({ timeout: 15_000 });
  });
});
