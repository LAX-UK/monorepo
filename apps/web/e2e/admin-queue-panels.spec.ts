/**
 * Work queue panels in Bid admin (staff design standard PRD-7): the open record is in the URL,
 * Back closes the panel, J and K step through the queue, and Escape returns focus to the row.
 * Manual review holds and AML screenings, on the seeded data.
 */
import { type Page, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";

const position = (page: Page) => page.locator("[data-staff-queue-position]");

async function openFirstRow(page: Page, param: string) {
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  await rows.first().locator("td").nth(1).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`[?&]${param}=`));
  await expect(position(page)).toContainText(`1 of ${count}`);
  return { panel, count };
}

for (const queue of [
  {
    name: "manual review holds",
    path: "/admin/payments?manualReview=1",
    param: "payment",
    table: "Payments",
  },
  {
    name: "AML screenings",
    path: "/admin/compliance/aml",
    param: "screening",
    table: "AML screening",
  },
]) {
  test.describe(`admin queue panel: ${queue.name} @journey`, () => {
    test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);

    test("the panel has an address that reopens it, and Back closes it", async ({ page }) => {
      await page.goto(queue.path);
      const { panel } = await openFirstRow(page, queue.param);
      const title = await panel.getByRole("heading", { level: 2 }).first().textContent();
      const address = page.url();

      await page.goBack();
      await expect(panel).toBeHidden();
      await expect(page).not.toHaveURL(new RegExp(`[?&]${queue.param}=`));

      await page.goto(address);
      await expect(page.getByRole("dialog").getByRole("heading", { level: 2 }).first()).toHaveText(
        title ?? "",
      );
    });

    test("J and K step through the queue, and Escape returns focus to the row", async ({
      page,
    }) => {
      await page.goto(queue.path);
      const { panel, count } = await openFirstRow(page, queue.param);
      test.skip(count < 2, "The seeded queue holds one record");
      const first = page.url();

      await page.keyboard.press("j");
      await expect(position(page)).toContainText(`2 of ${count}`);
      await expect(page).not.toHaveURL(first);
      const second = page.url();

      await page.keyboard.press("k");
      await expect(position(page)).toContainText(`1 of ${count}`);
      await page.keyboard.press("j");
      await expect(page).toHaveURL(second);

      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(page.locator("tbody tr").nth(1)).toBeFocused();
    });

    test("on a phone the panel is full screen with its actions in view", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(queue.path);
      // Below 768px the rows are a list of cards, labelled like the table.
      const cards = page.getByRole("list", { name: queue.table });
      await cards
        .getByRole("listitem")
        .first()
        .click({ position: { x: 300, y: 12 } });
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`[?&]${queue.param}=`));
      const box = await panel.boundingBox();
      expect(box?.width).toBe(375);
      const footer = panel.locator("[data-staff-panel-footer]");
      if ((await footer.count()) > 0) await expect(footer).toBeInViewport({ ratio: 1 });
      await page.goBack();
      await expect(panel).toBeHidden();
    });
  });
}
