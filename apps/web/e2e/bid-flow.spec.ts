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
    destination:
      /\/(home|bids|purchases|watching|selling|organisation|onboarding|lot|search|sales)(?:\/|[?#]|$)/,
  });
}

async function gotoLiveLot(page: Page) {
  await page.goto(liveLotPath);
  await page.waitForLoadState("networkidle");
}

test.describe("buyer bid flow @journey", () => {
  test("authenticated buyer can confirm a bid on a live lot", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await loginAsBuyer(page);
    await gotoLiveLot(page);

    const bidButton = page.getByRole("button", { name: /^bid £/i }).first();
    if (!(await bidButton.isVisible().catch(() => false))) {
      test.skip(true, "No bid button — set PLAYWRIGHT_LIVE_LOT_PATH to an active lot.");
    }

    await bidButton.click();
    const dialog = page.getByRole("dialog", { name: /place a bid/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /confirm bid of/i }).click();

    await expect(page.getByText(/bid placed at/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("buyer can choose a maximum in the bid dialog on a live lot", async ({ page }) => {
    test.skip(!enabled, skipReason);

    await loginAsBuyer(page);
    await gotoLiveLot(page);

    const bidButton = page.getByRole("button", { name: /^bid £/i }).first();
    if (!(await bidButton.isVisible().catch(() => false))) {
      test.skip(true, "No bid button — set PLAYWRIGHT_LIVE_LOT_PATH to an active English lot.");
    }

    await bidButton.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /set a maximum bid/i }).click();
    await expect(dialog.getByLabel(/your maximum/i)).toBeVisible();
  });

  test("outbid bidder can bid again from the lot page", async ({ page }) => {
    test.skip(!enabled, skipReason);
    test.skip(
      process.env.PLAYWRIGHT_OUTBID_LOT_PATH == null,
      "Set PLAYWRIGHT_OUTBID_LOT_PATH to a lot where the buyer is outbid.",
    );

    await loginAsBuyer(page);
    await page.goto(process.env.PLAYWRIGHT_OUTBID_LOT_PATH ?? liveLotPath);
    await page.waitForLoadState("networkidle");

    const cta = page.getByRole("button", { name: /^bid £/i }).first();

    if (!(await cta.isVisible().catch(() => false))) {
      test.skip(true, "No outbid CTA visible on this lot.");
    }

    await cta.click();
    await expect(page.getByRole("button", { name: /confirm bid of/i })).toBeVisible({
      timeout: 10_000,
    });
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
const authenticatedDestination =
  /\/(home|bids|purchases|watching|selling|organisation|onboarding|lot|search|sales)(?:\/|[?#]|$)/;
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
  test("email-unverified sign-in ends at hosted resend-verification before lot access", async ({
    page,
  }) => {
    test.skip(!enabled, skipReason);

    // Seeded unverified users are intentionally rejected by auth. Stale authenticated
    // email sessions are covered at component/API level instead of fabricated here.
    await loginWithCredentials(page, unverifiedCredentials, {
      destination: /\/resend-verification\?/,
    });

    const params = new URL(page.url()).searchParams;
    expect(params.get("client_id")).toBe("lax-bid-web");
    expect(params.get("email")).toBe(unverifiedCredentials.email);
    await expect(page.getByRole("heading", { name: "Resend verification" })).toBeVisible();
    await expect(page.getByRole("button", { name: /send verification email/i })).toBeVisible();
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
      await expect(
        page.locator("button:enabled").filter({ hasText: /^(bid £|set a maximum)/i }),
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

      const bidButton = page.getByRole("button", { name: /^bid £/i }).first();
      await expect(bidButton).toBeVisible();
      await expect(bidButton).toBeEnabled();
      await expect(
        page.getByText("Your identity must be approved before you can place bids."),
      ).toHaveCount(0);
    });
  }
});
