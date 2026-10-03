import { expect, test } from "@playwright/test";
import { signInShopBuyer } from "./helpers/shop-auth";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const isCi = process.env.CI === "true";
const skipReason =
  "Set PLAYWRIGHT_E2E=1 and PLAYWRIGHT_BASE_URL (Shop storefront) for phase 1 smoke.";

const portalFailureTitles = [
  "Ownership portal not enabled",
  "Could not load editions",
  "Could not load sale limits",
  "Unavailable",
] as const;

function requirePhase1E2e(): void {
  if (enabled) return;
  const message = `${skipReason} PLAYWRIGHT_E2E is not set.`;
  if (isCi) throw new Error(message);
  test.skip(true, message);
}

function requireShopBuyerCredentials(): { email: string; password: string } {
  const email = process.env.SHOP_OIDC_TEST_EMAIL;
  const password = process.env.SHOP_OIDC_TEST_PASSWORD;
  if (email && password) {
    return { email, password };
  }
  const message = `${skipReason} Provide SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD.`;
  if (isCi) throw new Error(message);
  test.skip(true, message);
}

function requirePortalOwnershipFlag(): void {
  if (process.env.SHOP_PORTAL_OWNERSHIP_ENABLED === "true") return;
  const message =
    "SHOP_PORTAL_OWNERSHIP_ENABLED must be true on shop-api and the storefront for portal smoke.";
  if (isCi) throw new Error(message);
  test.skip(true, message);
}

test.describe("Shop V1 phase 1 smoke", () => {
  test.setTimeout(120_000);

  test("signed-in account portal pages load without error notice", async ({ page }) => {
    requirePhase1E2e();
    requirePortalOwnershipFlag();
    const { email, password } = requireShopBuyerCredentials();

    await signInShopBuyer(page, { email, password }, "/account");
    for (const path of ["/account/editions", "/account/sale-limits"] as const) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}(\\?.*)?$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("#main-content")).toBeVisible();
      for (const title of portalFailureTitles) {
        await expect(page.getByText(title, { exact: true })).not.toBeVisible();
      }
      await expect(page.locator("#main-content")).not.toBeEmpty();
    }

    const ownedArtworkTitle = process.env.SHOP_ACCEPTANCE_OWNED_ARTWORK_TITLE?.trim();
    if (process.env.SHOP_ACCEPTANCE_PORTAL_SEEDED === "true") {
      if (!ownedArtworkTitle) {
        throw new Error("SHOP_ACCEPTANCE_OWNED_ARTWORK_TITLE is required when portal seed ran");
      }
      await page.goto("/account/editions");
      await expect(
        page.locator("#main-content").getByText(ownedArtworkTitle).first(),
      ).toBeVisible();
      await page.goto("/account/sale-limits");
      await expect(
        page.locator("#main-content").getByText(ownedArtworkTitle).first(),
      ).toBeVisible();
    }
  });

  test("account hub exposes ownership entry points", async ({ page }) => {
    requirePhase1E2e();
    requirePortalOwnershipFlag();
    const { email, password } = requireShopBuyerCredentials();

    await signInShopBuyer(page, { email, password }, "/account");
    await expect(page).toHaveURL(/\/account(\?.*)?$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByRole("link", { name: /my editions/i })).toBeVisible();
  });
});
