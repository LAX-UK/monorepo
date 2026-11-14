import { expect, test } from "@playwright/test";

/**
 * Local-only journey for the orders list (staff design standard TBL-8): a row opens the order's
 * page, and Back finds the list as it was, with its filter and sort in the address, the same
 * scroll, and the row that was opened focused and marked. Needs the stack, the dev seed and the
 * signed-in state that sign-in-local-staff.setup.ts saves (run it first).
 */
test.use({ storageState: "e2e/.auth/shop_admin.json" });

test("opens an order from its row and comes back to the list as it was", async ({ page }) => {
  await page.goto("/orders");
  const table = page.getByRole("grid");
  const rows = table.locator("tbody tr");
  await expect(rows.first()).toBeVisible();

  // Sort by total: the sort goes into the address, so Back can keep it.
  await table.getByRole("button", { name: /^Total/ }).click();
  await expect(page).toHaveURL(/[?&]sort=-?total\b/);
  const listUrl = page.url();

  // Click the row away from its link: the whole row opens the order.
  const row = rows.last();
  const reference = (await row.getByRole("link").first().textContent())?.trim() ?? "";
  await row.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));
  await row.locator("td").nth(3).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}\?list=/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(reference);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(listUrl);
  const returned = page.locator("tbody tr[data-staff-returned]");
  await expect(returned).toHaveCount(1);
  await expect(returned).toContainText(reference);
  await expect(returned).toBeFocused();
  const scrollAfter = await page.evaluate(() => Math.round(window.scrollY));
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(2);
});

test("opens an order in a new tab on Cmd- or Ctrl-click, leaving the list", async ({
  page,
  context,
}) => {
  await page.goto("/orders");
  const row = page.getByRole("grid").locator("tbody tr").first();
  await expect(row).toBeVisible();
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    row
      .locator("td")
      .nth(3)
      .click({ modifiers: ["ControlOrMeta"] }),
  ]);
  await tab.waitForLoadState();
  expect(new URL(tab.url()).pathname).toMatch(/^\/orders\/[0-9a-f-]{36}$/);
  await expect(page).toHaveURL(/\/orders$/);
  await tab.close();
});
