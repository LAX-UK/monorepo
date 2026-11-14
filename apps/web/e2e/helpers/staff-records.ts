import { type Locator, type Page, expect } from "@playwright/test";

/** A record page, opened on its own or from a list (`?list=` keeps the list's query). */
export const LOT_PAGE = /\/admin\/lots\/[^/?]+(\?list=[^#]*)?$/;
export const SALE_PAGE = /\/admin\/sales\/[^/?]+(\?list=[^#]*)?$/;

/** Catalogue lists open a record's page from its row: the title is a link to that page. */
export async function openRecordPage(page: Page, rowLink: Locator, url: RegExp): Promise<void> {
  await expect(rowLink).toBeVisible({ timeout: 10_000 });
  await rowLink.click();
  await page.waitForURL(url);
}
