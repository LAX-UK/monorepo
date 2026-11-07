import { expect, test } from "@playwright/test";
import {
  accountE2eEnabled,
  accountE2eSkipReason,
  collectorCredentials,
  expectPageHeading,
  signInAccount,
} from "./helpers/account-e2e";

test.describe("Account Money @journey", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!accountE2eEnabled, accountE2eSkipReason);
    const collector = collectorCredentials();
    test.skip(!collector, "ACCOUNT_E2E_COLLECTOR_EMAIL / _PASSWORD not set");
    if (collector) await signInAccount(page, collector, "/account/portfolio/money");
  });

  test("shows per-business totals and a ledger with product names", async ({ page }) => {
    await expectPageHeading(page, "Money");
    const totals = page.getByRole("region", { name: "Totals by business" });
    await expect(totals).toBeVisible();
    await expect(totals.getByRole("heading", { level: 2 }).first()).toBeVisible();
    // The collector's Bid payments put LAX Bid's legal entity in the totals, with the product
    // named under its heading.
    const bidCard = totals.getByRole("article", { name: "London Auction Xchange LTD" });
    await expect(
      bidCard.getByRole("heading", { name: "London Auction Xchange LTD" }),
    ).toBeVisible();
    await expect(bidCard.getByText("LAX Bid")).toBeVisible();

    const ledger = page.getByRole("region", { name: "Ledger" });
    await expect(ledger).toBeVisible();
    await expect(ledger.getByText(/LAX Bid|LAX Shop|lax\.art/).first()).toBeVisible();
  });
});
