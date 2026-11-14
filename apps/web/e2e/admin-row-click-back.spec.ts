/**
 * Catalogue lists whose rows open the record's page: the record keeps the list's query, shows
 * Previous and Next through it, and Back returns to the list as it was, with the row focused.
 *
 * Requires PLAYWRIGHT_E2E=1 and staff credentials with catalogue access.
 */
import type { Page } from "@playwright/test";
import { dismissStaffPaletteIfOpen, e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { expect, test } from "./helpers/auth.fixture";

const LISTS = [
  {
    name: "Lots",
    path: "/admin/lots?sort=endingAsc&limit=25",
    record: /\/admin\/lots\/[^/?]+\?list=/,
  },
  { name: "Sales", path: "/admin/sales?q=a&limit=25", record: /\/admin\/sales\/[^/?]+\?list=/ },
] as const;

/** The rows of the list's table, and the title link of the row at `index`. */
async function rowLink(page: Page, index: number) {
  const rows = page.getByRole("grid").locator("tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  const count = await rows.count();
  const row = rows.nth(Math.min(index, count - 1));
  return { row, link: row.locator("a[href]").first() };
}

test.describe("catalogue rows open their page, Back restores the list @journey", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  test.use({ viewport: { width: 1440, height: 600 } });

  for (const list of LISTS) {
    test(`${list.name}: row opens the record in its list, Back focuses the row`, async ({
      page,
    }) => {
      await page.goto(list.path);
      await dismissStaffPaletteIfOpen(page);
      const listUrl = page.url();
      const { row, link } = await rowLink(page, 3);
      const href = await link.getAttribute("href");
      expect(href).toMatch(list.record);

      await row.scrollIntoViewIfNeeded();
      const scrolled = await page.evaluate(() => window.scrollY);
      // A click on the row's background (not the title link) opens the record.
      await row.locator("td").nth(2).click();
      await expect(page).toHaveURL(list.record, { timeout: 30_000 });
      expect(new URL(page.url()).searchParams.get("list")).toBe(
        new URL(listUrl).searchParams.toString(),
      );
      // Previous and Next through the list it was opened from.
      await expect(page.getByText(/\d+ of \d+/).first()).toBeVisible({ timeout: 20_000 });

      await page.goBack();
      await expect(page).toHaveURL(listUrl, { timeout: 30_000 });
      const focused = await rowLink(page, 3);
      await expect(focused.row).toBeFocused();
      await expect(focused.link).toHaveAttribute("href", href ?? "");
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThanOrEqual(Math.max(0, scrolled - 2));
    });
  }

  test("an old panel link opens the lot's page in the same list", async ({ page }) => {
    await page.goto("/admin/lots?limit=25");
    const { link } = await rowLink(page, 0);
    const href = (await link.getAttribute("href")) ?? "";
    const id = href.split("?")[0]?.split("/").pop() ?? "";
    await page.goto(`/admin/lots?limit=25&lot=${id}`);
    await expect(page).toHaveURL(new RegExp(`/admin/lots/${id}\\?list=limit%3D25$`));
  });
});
