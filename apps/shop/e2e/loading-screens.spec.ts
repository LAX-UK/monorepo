import { defineLoadingScreenTests } from "@auction/e2e-utils/loading-check";
import { type Page, expect, test } from "@playwright/test";

// Shop's loading screens (docs/design/motion.md, MO12), against the seeded catalogue
// (`pnpm --filter @auction/shop-api seed:catalogue`). Opt-in locally; CI's browser gates run it.
// PLAYWRIGHT_LOADING_CHECK=1 pnpm --filter @auction/shop exec playwright test e2e/loading-screens.spec.ts

/** A print from the seeded catalogue, so the basket is measured with a line in it. */
const BASKET_FIXTURE_SLUG = "harbor-print";

async function basketWithAnItem(page: Page): Promise<void> {
  await page.goto(`/artworks/${BASKET_FIXTURE_SLUG}`);
  const add = page.getByRole("button", { name: /add to basket/i }).first();
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByRole("link", { name: /view basket/i }).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("shop loading screens @optin", () => {
  defineLoadingScreenTests(test, expect, "shop", [
    { name: "artworks", from: "/", to: "/artworks" },
    { name: "artists", from: "/", to: "/artists" },
    { name: "categories", from: "/", to: "/categories" },
    { name: "basket", from: "/", to: "/basket", prepare: basketWithAnItem },
  ]);
});
