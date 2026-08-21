import { type Page, expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, seed a live lot, and start apps/web + apps/api.";

/** Optional: PLAYWRIGHT_LIVE_LOT_PATH=/lot/slug/uuid for a known active English lot. */
const liveLotPath = process.env.PLAYWRIGHT_LIVE_LOT_PATH ?? "/search";

async function loginAsBuyer(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.PLAYWRIGHT_BUYER_EMAIL ?? "buyer@lax.bid");
  await page.getByLabel(/password/i).fill(process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|lot|search|sales/, { timeout: 20_000 });
}

/** Default lot entry mode is auto-bid; manual form is behind this chooser. */
async function selectManualBidMode(page: Page) {
  const manual = page.getByRole("button", { name: /place one bid now/i }).first();
  if (await manual.isVisible().catch(() => false)) {
    await manual.click();
  }
}

async function gotoLiveLot(page: Page) {
  await page.goto(liveLotPath);
  await page.waitForLoadState("networkidle");
}

test.describe("buyer bid flow @journey", () => {
  test("authenticated buyer can review and confirm a manual bid on a live lot", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);

    await loginAsBuyer(page);
    await gotoLiveLot(page);

    const reviewButton = page.getByRole("button", { name: /review bid/i }).first();
    if (!(await reviewButton.isVisible().catch(() => false))) {
      await selectManualBidMode(page);
    }
    if (!(await reviewButton.isVisible().catch(() => false))) {
      test.skip(true, "No review bid control — set PLAYWRIGHT_LIVE_LOT_PATH to an active lot.");
    }

    await reviewButton.click();
    await expect(page.getByRole("button", { name: /place bid/i })).toBeVisible();
    await page.getByRole("button", { name: /place bid/i }).click();

    await expect(page.getByText(/bid placed successfully/i)).toBeVisible({ timeout: 15_000 });
  });

  test("buyer can open auto-bid panel on a live lot", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await loginAsBuyer(page);
    await gotoLiveLot(page);

    const saveAutoBid = page.getByRole("button", { name: /save auto-bid/i }).first();
    if (!(await saveAutoBid.isVisible().catch(() => false))) {
      test.skip(true, "No auto-bid panel — set PLAYWRIGHT_LIVE_LOT_PATH to an active English lot.");
    }

    await expect(page.getByLabel(/max amount/i).first()).toBeVisible();
  });

  test("outbid sticky CTA is reachable when already outbid on SSR", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      process.env.PLAYWRIGHT_OUTBID_LOT_PATH == null,
      "Set PLAYWRIGHT_OUTBID_LOT_PATH to a lot where the buyer is outbid.",
    );

    await loginAsBuyer(page);
    await page.goto(process.env.PLAYWRIGHT_OUTBID_LOT_PATH ?? liveLotPath);
    await page.waitForLoadState("networkidle");

    const increaseBid = page.getByRole("button", { name: /increase bid/i }).first();
    const raiseMax = page.getByRole("button", { name: /raise (auto-bid max|max)/i }).first();
    const cta = (await increaseBid.isVisible().catch(() => false)) ? increaseBid : raiseMax;

    if (!(await cta.isVisible().catch(() => false))) {
      test.skip(true, "No outbid CTA visible on this lot.");
    }

    await cta.click();
    await expect(
      page.getByRole("button", { name: /review bid|save auto-bid/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

const strictEligibilityEnabled = ["1", "true", "yes", "on"].includes(
  process.env.STRICT_BID_ELIGIBILITY_ENABLED?.trim().toLowerCase() ?? "",
);

async function loginWithCredentials(page: Page, email: string, password: string) {
  await page.goto(`/login?email=${encodeURIComponent(email)}`);
  const continueButton = page.getByRole("button", { name: /^continue$/i });
  if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/dashboard|onboarding|lot|search|sales/, { timeout: 20_000 });
}

test.describe("strict bid eligibility @journey", () => {
  test("unverified email cannot reach live-lot bid controls", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!strictEligibilityEnabled, "Start web, API, and Playwright with strict eligibility.");

    await page.goto(`/login?email=${encodeURIComponent("unverified@lax.bid")}`);
    const continueButton = page.getByRole("button", { name: /^continue$/i });
    if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
    await expect(page).toHaveURL(/\/register\/verify-pending|\/login/);
    await expect(page.locator("#lot-bid-entry")).toHaveCount(0);
  });

  test("pending identity blocks all live-lot bid controls", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!strictEligibilityEnabled, "Start web, API, and Playwright with strict eligibility.");
    test.skip(
      process.env.PLAYWRIGHT_LIVE_LOT_PATH == null,
      "Set PLAYWRIGHT_LIVE_LOT_PATH to an active online lot.",
    );

    await loginWithCredentials(
      page,
      process.env.PLAYWRIGHT_STRICT_UNAPPROVED_EMAIL ?? "google-test@lax.bid",
      process.env.PLAYWRIGHT_STRICT_UNAPPROVED_PASSWORD ?? "Password123!",
    );
    await gotoLiveLot(page);

    await expect(
      page.getByText("Your identity must be approved before you can place bids.").first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /review bid|save auto-bid/i })).toHaveCount(0);
  });

  test("approved identity retains manual and auto controls", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(!strictEligibilityEnabled, "Start web, API, and Playwright with strict eligibility.");
    test.skip(
      process.env.PLAYWRIGHT_LIVE_LOT_PATH == null,
      "Set PLAYWRIGHT_LIVE_LOT_PATH to an active online lot.",
    );

    await loginWithCredentials(
      page,
      process.env.PLAYWRIGHT_STRICT_APPROVED_EMAIL ?? "user1@lax.bid",
      process.env.PLAYWRIGHT_STRICT_APPROVED_PASSWORD ?? "Password123!",
    );
    await gotoLiveLot(page);
    await expect(page.getByRole("button", { name: /save auto-bid/i }).first()).toBeEnabled();
    await selectManualBidMode(page);
    await expect(page.getByRole("button", { name: /review bid/i }).first()).toBeEnabled();
  });
});
