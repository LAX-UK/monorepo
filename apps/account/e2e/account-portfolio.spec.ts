import { expect, test } from "@playwright/test";
import { accountAuthState } from "./helpers/account-auth-state";
import { collectorSkipReason, expectPageHeading } from "./helpers/account-e2e";

const skipReason = collectorSkipReason();

test.describe("Account Portfolio @journey", () => {
  test.skip(skipReason !== null, skipReason ?? "");
  test.use({ storageState: accountAuthState.collector });

  test.beforeEach(async ({ page }) => {
    await page.goto("/account/portfolio");
  });

  test("desktop shows the works table", async ({ page }) => {
    await expectPageHeading(page, "Portfolio");
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    for (const column of ["Work", "Product", "Acquired", "Paid", "Status", "Documents"]) {
      await expect(table.getByRole("columnheader", { name: column })).toBeVisible();
    }
    await expect(table.getByRole("row")).not.toHaveCount(1);
  });

  test("at 375px the works are cards, not a table", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expectPageHeading(page, "Portfolio");
    await expect(page.getByRole("table")).toBeHidden();
    await expect(
      page.getByRole("region", { name: "Works and purchases" }).getByRole("listitem").first(),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("grouped copies open and close", async ({ page }) => {
    // Only works held more than once have a "N copies" button.
    const toggle = page.getByRole("button", { name: /\d+ copies/ }).first();
    test.skip((await toggle.count()) === 0, "no grouped copies in this seed");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("search narrows the list", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: "Search your works by title or artist" });
    await expect(search).toBeVisible();
    await search.fill("zzqx-no-such-work-9271");
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "No works match these filters" })).toBeVisible();
    await expect(page).toHaveURL(/q=zzqx-no-such-work-9271/);
  });
});
