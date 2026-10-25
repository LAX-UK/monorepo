import { type Locator, type Page, expect } from "@playwright/test";

export const LOT_PAGE = /\/admin\/lots\/[^/?]+$/;
export const SALE_PAGE = /\/admin\/sales\/[^/?]+$/;

/**
 * Staff lists open a record in a side panel from its title; the record's own page is the panel's
 * "Open full page" link.
 */
export async function openRecordPageFromPanel(
  page: Page,
  rowLink: Locator,
  url: RegExp,
): Promise<void> {
  await rowLink.click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await panel.getByRole("link", { name: /open full page/i }).click();
  await page.waitForURL(url);
}
