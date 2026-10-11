import { expect, test } from "@playwright/test";
import {
  artBuyerCredentials,
  artE2eEnabled,
  artE2eSkipReason,
  artPayoutsEnabled,
  expectSignInRedirect,
  firstArtworkHref,
  signInArtBuyer,
} from "./helpers/art-e2e";

test.describe("lax.art journeys", () => {
  test.beforeEach(() => {
    test.skip(!artE2eEnabled, artE2eSkipReason);
  });

  test("browse, filter, and open an artwork", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "filter rail is desktop-only");
    await page.goto("/artworks");
    await expect(page.getByRole("heading", { level: 1, name: "Artworks" })).toBeVisible();

    const originals = () => page.getByRole("button", { name: "Originals", exact: true }).first();
    await originals().click();
    await expect(page).toHaveURL(/[?&]type=original/);
    await expect(originals()).toHaveAttribute("aria-pressed", "true");

    const cards = page.getByTestId("art-artwork-card");
    test.skip((await cards.count()) === 0, "no art-channel originals seeded");
    const title = cards.first().getByRole("heading").getByRole("link");
    const name = (await title.textContent())?.trim() ?? "";
    await title.click();
    await expect(page).toHaveURL(/\/artworks\/[^/?]+/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByTestId("art-artwork-price")).toBeVisible();
  });

  test("search finds a listed work and reports misses", async ({ page }) => {
    const href = await firstArtworkHref(page);
    test.skip(!href, "no art-channel artworks seeded");
    const title =
      (
        await page.getByTestId("art-artwork-card").first().getByRole("heading").textContent()
      )?.trim() ?? "";

    await page.goto(`/search?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await expect(page.getByTestId("art-artwork-card").first()).toBeVisible();

    await page.goto("/search?q=zzqx-no-such-artwork-9271");
    await expect(page.getByTestId("art-search-no-results")).toBeVisible();
    await expect(page.getByText("No results for “zzqx-no-such-artwork-9271”")).toBeVisible();
  });

  test("signed-out enquiry redirects to sign-in and returns to the open sheet", async ({
    page,
  }) => {
    const href = await firstArtworkHref(page);
    test.skip(!href, "no art-channel artworks seeded");
    await expectSignInRedirect(page, `${href}?enquire=1`, `${href}?enquire=1`);

    await page.goto(href as string);
    await expect(page.getByTestId("art-enquire-sign-in")).toHaveAttribute(
      "href",
      `/login?returnTo=${encodeURIComponent(`${href}?enquire=1`)}`,
    );
  });

  test("signed-out heart sends the viewer to sign-in", async ({ page }) => {
    const href = await firstArtworkHref(page);
    test.skip(!href, "no art-channel artworks seeded");
    const heart = page
      .getByTestId("art-artwork-card")
      .first()
      .getByRole("button", { name: /^Sign in to save / });
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await Promise.all([
      page.waitForURL((url) => url.pathname.endsWith("/login") || url.port === "3051", {
        timeout: 30_000,
      }),
      heart.click(),
    ]);
  });

  test("saved favorites persist after reload", async ({ page }) => {
    const credentials = artBuyerCredentials();
    test.skip(!credentials, "Set ART_E2E_BUYER_EMAIL and ART_E2E_BUYER_PASSWORD");
    await signInArtBuyer(page, credentials as NonNullable<typeof credentials>, "/artworks");
    const card = page.getByTestId("art-artwork-card").first();
    test.skip((await card.count()) === 0, "no art-channel artworks seeded");

    const heart = card.getByRole("button", { name: /^Save .* to favorites$/ });
    const initiallySaved = (await heart.getAttribute("aria-pressed")) === "true";
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", String(!initiallySaved));
    await expect(heart).not.toHaveAttribute("aria-busy", "true");

    await page.reload();
    const reloaded = page
      .getByTestId("art-artwork-card")
      .first()
      .getByRole("button", { name: /^Save .* to favorites$/ });
    await expect(reloaded).toHaveAttribute("aria-pressed", String(!initiallySaved));

    await reloaded.click();
    await expect(reloaded).toHaveAttribute("aria-pressed", String(initiallySaved));
  });

  test("payouts tab exists only when the payouts flag is on", async ({ page }) => {
    if (artPayoutsEnabled) {
      await expectSignInRedirect(page, "/account/payouts", "/account/payouts");
    } else {
      await page.goto("/account/payouts");
      await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    }

    const credentials = artBuyerCredentials();
    test.skip(!credentials, "nav assertion needs ART_E2E_BUYER_EMAIL and ART_E2E_BUYER_PASSWORD");
    await signInArtBuyer(page, credentials as NonNullable<typeof credentials>, "/account");
    const accountNav = page.getByRole("navigation", { name: "Account" });
    await expect(accountNav.getByRole("link", { name: "Favorites" })).toBeVisible();
    await expect(accountNav.getByRole("link", { name: "Payouts" })).toHaveCount(
      artPayoutsEnabled ? 1 : 0,
    );
  });

  test("dark mode toggle persists across reloads", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const html = page.locator("html");
    const startedDark = await html.evaluate((el) => el.classList.contains("dark"));
    await page
      .getByRole("button", { name: /Switch to (dark|light) theme/ })
      .first()
      .click();
    await expect
      .poll(() => html.evaluate((el) => el.classList.contains("dark")))
      .toBe(!startedDark);

    await page.reload();
    await expect
      .poll(() => html.evaluate((el) => el.classList.contains("dark")))
      .toBe(!startedDark);

    await page
      .getByRole("button", { name: /Switch to (dark|light) theme/ })
      .first()
      .click();
    await expect.poll(() => html.evaluate((el) => el.classList.contains("dark"))).toBe(startedDark);
  });

  test("mobile bottom nav marks the current tab", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "bottom nav is mobile-only");
    await page.goto("/search");
    const nav = page.getByTestId("art-mobile-bottom-nav");
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
