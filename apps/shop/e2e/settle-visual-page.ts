import type { Page } from "@playwright/test";

/** Scroll images into view and wait for decode so full-page screenshots are stable in CI. */
export async function settleVisualPage(page: Page) {
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((node) => {
      const element = node as HTMLImageElement;
      const settle = (): Promise<void> =>
        element.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              element.addEventListener("load", () => resolve(), { once: true });
              element.addEventListener("error", () => resolve(), { once: true });
            });
      const timeout = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 8_000);
      });
      return Promise.race([settle(), timeout]);
    });
  }
  await page.locator(".shop-home__scroll-row").evaluateAll((regions) => {
    for (const region of regions) region.scrollLeft = 0;
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}
