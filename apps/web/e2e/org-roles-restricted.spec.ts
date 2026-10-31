import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  openAs,
  placeBid,
} from "./helpers/organisation-journeys";
import { expectWorkspaceBaselines } from "./helpers/workspace-baselines";

/**
 * An organisation whose bidding is paused still shows why, refuses a bid, and lets its owner pay
 * what it already owes.
 */

const { restricted } = ORGANISATION_JOURNEY_NAMES;

test.describe("restricted organisation journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("shows the banner, refuses a bid and still pays an invoice", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const owner = await openAs(browser, roleAuthState.buyer, restricted, baseURL);
    const { page } = owner;

    await test.step("the banner says bidding and selling are paused", async () => {
      await page.goto("/home");
      await expectActingAs(page, restricted, "Owner");
      await expect(page.getByText("Bidding and selling paused.").first()).toBeVisible();
    });

    await test.step("a bid is refused with the reason", async () => {
      const bid = await placeBid(owner, ORGANISATION_JOURNEY_IDS.lotForOwner, 2150);
      expect(bid.status).toBe(403);
      expect(bid.error).toContain("Bidding is paused for this organisation");
    });

    await test.step("the invoice can still be paid", async () => {
      await page.goto("/purchases");
      await expect(
        page.getByText("Harbour Light, won for a paused organisation").first(),
      ).toBeVisible();

      await page.goto(`/purchases/checkout/${ORGANISATION_JOURNEY_IDS.lotInvoiceRestricted}`);
      await expect(page.getByText("Invoice and payment").first()).toBeVisible();
      await expect(page.getByText(/You don't have access to/)).toHaveCount(0);
    });

    await owner.close();
  });
});

test.describe("restricted organisation baselines @a11y", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("every workspace page passes axe in light and dark at 1440 and 375", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    await expectWorkspaceBaselines(browser, roleAuthState.buyer, restricted, baseURL);
  });
});
