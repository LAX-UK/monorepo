import { type Page, expect, test } from "@playwright/test";
import { type Credentials, loginWithCredentials } from "./helpers/auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, seed a live lot, and start apps/web + apps/api.";

/** Optional: PLAYWRIGHT_LIVE_LOT_PATH=/lot/slug/uuid for a known active English lot. */
const liveLotPath = process.env.PLAYWRIGHT_LIVE_LOT_PATH ?? "/search";

const buyerCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_BUYER_EMAIL ?? "estate-owner@lax.bid",
  password: process.env.PLAYWRIGHT_BUYER_PASSWORD ?? "Password123!",
};

async function loginAsBuyer(page: Page) {
  await loginWithCredentials(page, buyerCredentials, {
    destination: /\/(dashboard|onboarding|lot|search|sales)(?:\/|[?#]|$)/,
  });
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

// Require the flag explicitly in the Playwright process even though local app defaults enable it.
// This prevents a passing journey against servers started with a different rollout configuration.
const strictEligibilityEnabled = ["1", "true", "yes", "on"].includes(
  process.env.STRICT_BID_ELIGIBILITY_ENABLED?.trim().toLowerCase() ?? "",
);
const strictUnapprovedCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_STRICT_UNAPPROVED_EMAIL ?? "google-test@lax.bid",
  password: process.env.PLAYWRIGHT_STRICT_UNAPPROVED_PASSWORD ?? "Password123!",
};
const strictApprovedCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_STRICT_APPROVED_EMAIL ?? "user1@lax.bid",
  password: process.env.PLAYWRIGHT_STRICT_APPROVED_PASSWORD ?? "Password123!",
};
const unverifiedCredentials: Credentials = {
  email: process.env.PLAYWRIGHT_UNVERIFIED_EMAIL ?? "unverified@lax.bid",
  password: process.env.PLAYWRIGHT_UNVERIFIED_PASSWORD ?? "Password123!",
};
const authenticatedDestination = /\/(dashboard|onboarding|lot|search|sales)(?:\/|[?#]|$)/;
const strictLotCases = [
  {
    name: "online",
    path: process.env.PLAYWRIGHT_LIVE_LOT_PATH,
    missingPathReason:
      "Set PLAYWRIGHT_LIVE_LOT_PATH to an active online or hybrid web-bidding lot.",
  },
  {
    name: "hybrid",
    path: process.env.PLAYWRIGHT_HYBRID_LOT_PATH,
    missingPathReason:
      "Optional: set PLAYWRIGHT_HYBRID_LOT_PATH to exercise a separate hybrid web-bidding lot.",
  },
] as const;

async function gotoStrictBidLot(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#lot-bid-entry")).toBeVisible({ timeout: 20_000 });
}

test.describe("strict bid eligibility @journey", () => {
  test("email-unverified sign-in ends at verify-pending before lot access", async ({ page }) => {
    test.skip(!enabled, skipReason);

    // Seeded unverified users are intentionally rejected by auth. Stale authenticated
    // email sessions are covered at component/API level instead of fabricated here.
    await loginWithCredentials(page, unverifiedCredentials, {
      destination: /\/register\/verify-pending(?:[/?#]|$)/,
    });

    await expect(page).toHaveURL(/\/register\/verify-pending(?:[/?#]|$)/);
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.getByRole("button", { name: /send again/i })).toBeVisible();
    await expect(page.locator("#lot-bid-entry")).toHaveCount(0);
  });

  for (const lotCase of strictLotCases) {
    test(`${lotCase.name} lot blocks email-verified user pending identity approval`, async ({
      page,
    }) => {
      test.skip(!enabled, skipReason);
      test.skip(
        !strictEligibilityEnabled,
        "Run Playwright and both servers with STRICT_BID_ELIGIBILITY_ENABLED=true.",
      );
      test.skip(lotCase.path == null, lotCase.missingPathReason);

      await loginWithCredentials(page, strictUnapprovedCredentials, {
        destination: authenticatedDestination,
      });
      await gotoStrictBidLot(page, lotCase.path ?? "/search");

      await expect(
        page.getByText("Your identity must be approved before you can place bids.").first(),
      ).toBeVisible();
      await expect(page.locator("button:enabled").filter({ hasText: /review bid/i })).toHaveCount(
        0,
      );
      await expect(
        page.locator("button:enabled").filter({ hasText: /save auto-bid/i }),
      ).toHaveCount(0);
    });

    test(`${lotCase.name} lot retains controls for approved user`, async ({ page }) => {
      test.skip(!enabled, skipReason);
      test.skip(
        !strictEligibilityEnabled,
        "Run Playwright and both servers with STRICT_BID_ELIGIBILITY_ENABLED=true.",
      );
      test.skip(lotCase.path == null, lotCase.missingPathReason);

      await loginWithCredentials(page, strictApprovedCredentials, {
        destination: authenticatedDestination,
      });
      await gotoStrictBidLot(page, lotCase.path ?? "/search");

      const saveAutoBid = page.getByRole("button", { name: /save auto-bid/i }).first();
      await expect(saveAutoBid).toBeVisible();
      await expect(saveAutoBid).toBeEnabled();
      await selectManualBidMode(page);
      const reviewBid = page.getByRole("button", { name: /review bid/i }).first();
      await expect(reviewBid).toBeVisible();
      await expect(reviewBid).toBeEnabled();
      await expect(
        page.getByText("Your identity must be approved before you can place bids."),
      ).toHaveCount(0);
    });
  }
});
