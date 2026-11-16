import { expect, test } from "@playwright/test";
import { resolveSaleRoutes } from "./public-routes";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

test.describe("lot quick look @smoke", () => {
  test("the browser Back button closes the quick look and keeps the sale page where it was", async ({
    page,
    request,
  }) => {
    test.skip(!enabled, skipReason);
    const [sale] = await resolveSaleRoutes(request);
    test.skip(!sale, "No seeded sale to open");
    if (!sale) return;

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(sale.path);
    const saleUrl = page.url();

    const trigger = page.getByRole("button", { name: /^Quick look at / }).nth(1);
    await trigger.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "View lot" })).toBeInViewport();

    await page.goBack();

    await expect(dialog).toBeHidden();
    expect(page.url()).toBe(saleUrl);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(trigger).toBeFocused();
  });
});
