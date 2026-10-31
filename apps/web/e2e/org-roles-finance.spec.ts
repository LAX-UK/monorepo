import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  expectNoAccess,
  openAs,
} from "./helpers/organisation-journeys";

/**
 * Finance at Northbank Gallery settles what the organisation owes and reads what it is paid: the
 * invoice for a lot the owner won opens at its payment step, and a payout has a statement. Bids
 * and the team stay closed.
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;

test.describe("organisation finance journey @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("reaches the invoice payment step and opens a payout statement", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const finance = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = finance;

    await test.step("acts as finance", async () => {
      await page.goto("/home");
      await expectActingAs(page, approved, "Finance");
    });

    await test.step("sees the organisation's invoice and reaches its payment step", async () => {
      await page.goto("/purchases");
      await expect(page.getByText("Harbour Light, won for Northbank").first()).toBeVisible();

      await page.goto(`/purchases/checkout/${ORGANISATION_JOURNEY_IDS.lotInvoiceNorthbank}`);
      await expect(page.getByText("Invoice and payment").first()).toBeVisible();
      await expect(page.getByText(/You don't have access to/)).toHaveCount(0);
    });

    await test.step("opens a payout statement", async () => {
      // Payouts are a view of Sold & payouts; each opens to its page, which holds the statement.
      await page.goto("/selling/payouts?tab=payouts");
      const payout = page.locator(
        `a[href$="/selling/payouts/${ORGANISATION_JOURNEY_IDS.payoutPaid}"]`,
      );
      await expect(payout.first()).toBeVisible();
      await payout.first().click();
      const statement = page.getByRole("link", { name: "Download statement (PDF)" });
      await expect(statement.first()).toBeVisible();
      const href = await statement.first().getAttribute("href");
      const response = await page.request.get(href ?? "", { maxRedirects: 0 });
      expect([200, 302, 303, 307, 308]).toContain(response.status());
    });

    await test.step("bids and the team stay closed", async () => {
      await expectNoAccess(page, "/bids");
      await expectNoAccess(page, "/team");
    });

    await finance.close();
  });
});
