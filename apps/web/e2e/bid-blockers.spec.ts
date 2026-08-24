import { expect, test } from "@playwright/test";
import { type Credentials, loginWithCredentials } from "./helpers/auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, seed a live lot, and start apps/web + apps/api.";
const liveLotPath = process.env.PLAYWRIGHT_LIVE_LOT_PATH ?? "/search";
const unverifiedCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_UNVERIFIED_EMAIL ?? "unverified@lax.bid",
  password: process.env.PLAYWRIGHT_UNVERIFIED_PASSWORD ?? "Password123!",
};

test.describe("bid blockers @journey", () => {
  test("signed-out visitors see the sign-in bid blocker", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      process.env.PLAYWRIGHT_LIVE_LOT_PATH == null,
      "Set PLAYWRIGHT_LIVE_LOT_PATH to an active lot.",
    );

    await page.goto(liveLotPath, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("bid-blocker")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Sign in to bid" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in to continue/i })).toBeVisible();
    await expect(page.locator("button:enabled").filter({ hasText: /review bid/i })).toHaveCount(0);
  });

  test("unverified email sign-in is blocked before lot bidding", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await loginWithCredentials(page, unverifiedCredentials, {
      destination: /\/register\/verify-pending(?:[/?#]|$)/,
    });

    await expect(page).toHaveURL(/\/register\/verify-pending(?:[/?#]|$)/);
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.locator("#lot-bid-entry")).toHaveCount(0);
  });
});
