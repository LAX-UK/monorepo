import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * Local-only journey for the work queues' panels (staff design standard, PRD-7), on Fulfilment
 * and Payouts: a row opens the panel with the record in the URL, the panel shows its place and
 * J/K step through the queue, Back closes it and leaves the list as it was, Esc returns focus to
 * the row, a reload reopens the panel, and on a phone the panel fills the screen with its footer
 * in view. Needs the stack, scripts/local/start-shop-admin.sh, at least two fulfilments and two
 * payouts (apps/shop-api `seed:acceptance-staff-operations` makes them), and the signed-in state
 * that sign-in-local-staff.setup.ts saves (run it first). Nothing is changed: Mark paid is only
 * opened and cancelled.
 */
test.use({ storageState: "e2e/.auth/shop_admin.json" });

const grid = (page: Page, name: string) => page.getByRole("grid", { name });
const panel = (page: Page) => page.getByRole("dialog");
const position = (page: Page) => panel(page).locator("[data-staff-queue-position]");

/** A cell of the row with nothing to click in it, so a click there is a click on the row. */
function plainCell(row: Locator): Locator {
  return row.locator("td:not(:has(a, button, input))").first();
}

/** The title links of the table's rows, in order. */
function titleLinks(page: Page, name: string): Locator {
  return grid(page, name).locator("tbody tr td a[href]").filter({ hasNotText: /^$/ });
}

async function queueRoundTrip(page: Page, path: string, name: string, param: string) {
  await page.goto(path);
  await expect(grid(page, name)).toBeVisible();
  const rows = grid(page, name).locator("tbody tr");
  const total = await rows.count();
  expect(total, `at least two rows on ${path}`).toBeGreaterThanOrEqual(2);
  const idParam = new RegExp(`[?&]${param}=([0-9a-f-]{36})`);

  // A plain click on the row opens the panel in place, with the record in the URL.
  await plainCell(rows.nth(0)).click();
  await expect(panel(page)).toBeVisible();
  await expect(page).toHaveURL(idParam);
  const firstId = idParam.exec(page.url())?.[1];
  await expect(position(page)).toHaveText(`1 of ${total} in this queue`);

  // J steps on in place, K back.
  await page.keyboard.press("j");
  await expect(position(page)).toHaveText(`2 of ${total} in this queue`);
  const secondId = idParam.exec(page.url())?.[1];
  expect(secondId).toBeTruthy();
  expect(secondId).not.toBe(firstId);
  await page.keyboard.press("k");
  await expect(position(page)).toHaveText(`1 of ${total} in this queue`);
  await page.keyboard.press("j");
  await expect(page).toHaveURL(new RegExp(`${param}=${secondId}`));

  // Back closes the panel and stays on the list.
  await page.goBack();
  await expect(panel(page)).toBeHidden();
  await expect(page).not.toHaveURL(idParam);
  await expect(grid(page, name)).toBeVisible();

  // The panel's address reopens it.
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}${param}=${secondId}`);
  await expect(position(page)).toHaveText(`2 of ${total} in this queue`);

  // Esc closes it and puts focus on the row of the record shown.
  await page.goto(path);
  await plainCell(rows.nth(0)).click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("j");
  await expect(position(page)).toHaveText(`2 of ${total} in this queue`);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(rows.nth(1)).toBeFocused();
  await expect(page).not.toHaveURL(idParam);

  // A new tab from the row keeps the record's own address.
  await expect(titleLinks(page, name).first()).toHaveAttribute("href", idParam);
  return { total, secondId };
}

test("fulfilment steps through its panel, and Back and Esc close it", async ({ page }) => {
  await queueRoundTrip(page, "/fulfilment?view=all", "Fulfilment", "fulfilment");
  await page.goto("/fulfilment?view=all");
  await plainCell(grid(page, "Fulfilment").locator("tbody tr").first()).click();
  await expect(panel(page).getByRole("link", { name: "Open order" })).toHaveAttribute(
    "href",
    /^\/orders\/[0-9a-f-]{36}#fulfilment$/,
  );
});

test("payouts step through their panel, and Mark paid still asks first", async ({ page }) => {
  await queueRoundTrip(page, "/payouts?view=all", "Payouts", "payout");
  await page.goto("/payouts?view=all");
  await plainCell(grid(page, "Payouts").locator("tbody tr").first()).click();
  const markPaid = panel(page).getByRole("button", { name: /^Mark .* paid$/ });
  await expect(markPaid).toBeVisible();
  if ((await markPaid.getAttribute("aria-disabled")) === "true") {
    // Still in its refund period: the action says why it waits.
    await markPaid.hover();
    await expect(page.getByRole("tooltip")).toContainText(/refund period/i);
  } else {
    await markPaid.click();
    const confirm = page.getByRole("dialog", { name: /^Mark the payout to .* as paid\?$/ });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test("a queue panel fills the screen with its footer in view, and Back closes it", async ({
    page,
  }) => {
    await page.goto("/payouts?view=all");
    const card = page.locator("ul li").filter({ has: page.locator("a[href*='payout=']") });
    await card.first().locator("a[href*='payout=']").first().click();
    await expect(panel(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]payout=/);
    const box = await panel(page).boundingBox();
    expect(box?.width).toBe(375);
    await expect(panel(page).locator("[data-staff-panel-footer]")).toBeInViewport();
    await page.goBack();
    await expect(panel(page)).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]payout=/);
  });
});
