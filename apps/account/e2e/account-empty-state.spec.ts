import { expect, test } from "@playwright/test";
import { accountAuthState } from "./helpers/account-auth-state";
import { expectPageHeading, newPersonSkipReason, trackConsoleErrors } from "./helpers/account-e2e";

const skipReason = newPersonSkipReason();

test.describe("Account for a person with no data @journey", () => {
  test.skip(skipReason !== null, skipReason ?? "");
  // Parked: in CI the no-data person's LAX Bid and LAX Shop reads come back incomplete, so Account
  // rightly shows "not shown yet" instead of the new-person state. Re-enable once those reads
  // answer for that person (tracked as AC-6b).
  test.fixme(true, "Bid and Shop portfolio reads are incomplete for the CI no-data person");
  test.use({ storageState: accountAuthState.newPerson });

  test("Home invites them to start a collection", async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1, name: /^Welcome/ })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Start your collection" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Works you buy on lax\.art, LAX Shop and LAX Bid all appear here/),
    ).toBeVisible();
    await expect(page.getByText(/can't show your works/i)).toHaveCount(0);
    expect(consoleErrors()).toEqual([]);
  });

  test("Portfolio and Money show empty states, not errors", async ({ page }) => {
    await page.goto("/account/portfolio");
    await expectPageHeading(page, "Portfolio");
    await expect(
      page.getByRole("heading", { level: 2, name: /^Works you buy on .* appear here$/ }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);

    await page.goto("/account/portfolio/money");
    await expectPageHeading(page, "Money");
    await expect(page.getByRole("heading", { name: "No money to show yet" })).toBeVisible();
  });
});
