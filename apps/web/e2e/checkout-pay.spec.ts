import { expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import {
  ORGANISATION_JOURNEY_IDS,
  ORGANISATION_JOURNEY_NAMES,
  expectActingAs,
  openAs,
} from "./helpers/organisation-journeys";

/**
 * Finance at Northbank Gallery pays for an invoice on the Pay page: the old checkout address
 * lands there in one step, the page states the invoice and the company that issues it, and the
 * only way to pay is the one button that sends back what was shown. Nothing is paid here: the
 * payment itself finishes on Stripe's page.
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;
const lotId = ORGANISATION_JOURNEY_IDS.lotInvoiceNorthbank;
const title = "Harbour Light, won for Northbank";

test.describe("Pay page @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  test("an emailed checkout link opens the Pay page, which states the invoice and offers Pay", async ({
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

    await test.step("the old checkout address lands on the Pay page", async () => {
      await page.goto(`/purchases/checkout/${lotId}`);
      await expect(page).toHaveURL(new RegExp(`/purchases/pay\\?lots=${lotId}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Pay for ${title}`);
    });

    await test.step("states the invoice and who it is from", async () => {
      const payment = page.getByRole("region", { name: "Payment" });
      await expect(payment.getByText("Hammer price")).toBeVisible();
      await expect(payment.getByText(/^Buyer's premium/)).toBeVisible();
      await expect(payment.getByText("Total to pay")).toBeVisible();
      await expect(payment.getByText(/Invoice from London Auction Xchange LTD/)).toBeVisible();
      await expect(page.getByRole("region", { name: "Lot" })).toContainText(title);
    });

    await test.step("has one action and none of the old checkout", async () => {
      await expect(page.getByRole("button", { name: /^Pay £/ }).first()).toBeEnabled();
      await expect(page.getByText(/Concierge|Insured shipping|Payment protection/)).toHaveCount(0);
      await expect(page.getByRole("checkbox")).toHaveCount(0);
    });

    await finance.close();
  });

  test("a link with no lots, or with lots that are not this account's, explains itself", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const finance = await openAs(browser, roleAuthState.unapproved, approved, baseURL);
    const { page } = finance;

    await test.step("no lots", async () => {
      await page.goto("/purchases/pay");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pay");
      await expect(page.getByRole("heading", { level: 2, name: "Nothing to pay" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open purchases" })).toBeVisible();
    });

    await test.step("a link that is not a list of lots", async () => {
      await page.goto("/purchases/pay?lots=not-a-lot");
      await expect(page.getByText(/doesn't name any lots/)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Pay/ })).toHaveCount(0);
    });

    await finance.close();
  });
});
