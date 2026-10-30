import { expect, test } from "@playwright/test";
import {
  artBuyerCredentials,
  artE2eEnabled,
  artE2eSkipReason,
  expectSignInRedirect,
  firstArtworkHref,
  signInArtBuyer,
} from "./helpers/art-e2e";

test.describe("lax.art journeys", () => {
  test.beforeEach(() => {
    test.skip(!artE2eEnabled, artE2eSkipReason);
  });

  test("browse, filter, and open an artwork", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "drawer copy is checked on desktop");
    await page.goto("/artworks");
    await expect(page.getByRole("heading", { level: 1, name: "Artworks" })).toBeVisible();

    const openFilters = () =>
      page
        .getByRole("button", { name: /^Filters/ })
        .first()
        .click();
    const drawer = page.getByRole("dialog", { name: "Filters" });
    await openFilters();
    // lax.art lists originals only: no Department or Rarity choice to make.
    await expect(drawer.getByRole("button", { name: "Department" })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Rarity" })).toHaveCount(0);
    await drawer.getByRole("radio", { name: "Title (A–Z)", exact: true }).check();
    await drawer.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/[?&]sort=titleAsc/);
    await openFilters();
    await expect(drawer.getByRole("radio", { name: "Title (A–Z)", exact: true })).toBeChecked();
    await drawer.getByRole("button", { name: "Cancel" }).click();

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
    const tabs = page.getByRole("navigation", { name: "Search results" });
    await expect(tabs.getByRole("link", { name: /^Available/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("art-search-count")).toBeVisible();

    await tabs.getByRole("link", { name: /^Sold/ }).click();
    await expect(page).toHaveURL(/[?&]tab=sold/);
    await expect(tabs.getByRole("link", { name: /^Sold/ })).toHaveAttribute("aria-current", "page");

    await page.goto("/search?q=zzqx-no-such-artwork-9271");
    await expect(page.getByTestId("art-search-no-results")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /^No results for/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse artworks" })).toHaveAttribute(
      "href",
      "/artworks",
    );
  });

  test("empty search offers a search field and a way to browse everything", async ({ page }) => {
    await page.goto("/search");
    await expect(
      page.getByRole("heading", { level: 1, name: "Search by artist or artwork" }),
    ).toBeVisible();
    const field = page.getByTestId("art-search-input");
    await field.fill("zzqx-no-such-artwork-9271");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=zzqx-no-such-artwork-9271/);
    await expect(page.getByTestId("art-search-no-results")).toBeVisible();
  });

  test("a guest sees field errors, then sends an artwork enquiry without signing in", async ({
    page,
  }) => {
    const href = await firstArtworkHref(page);
    test.skip(!href, "no art-channel artworks seeded");
    await page.goto(href as string);
    await expect(page.getByTestId("art-enquire-sign-in")).toHaveCount(0);
    await page.getByTestId("art-enquire-trigger").click();

    const sheet = page.getByRole("dialog", { name: "Send an enquiry" });
    await expect(sheet).toBeVisible();
    const name = sheet.getByLabel("Name");
    const email = sheet.getByLabel("Email");

    await sheet.getByRole("button", { name: "Send enquiry" }).click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");

    await name.fill("Grace Hopper");
    await email.fill("not-an-email");
    await email.blur();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(sheet.getByText(/valid email address/)).toBeVisible();

    await email.fill(`grace+${Date.now()}@example.com`);
    await sheet.getByLabel("Message (optional)").fill("Is this work still available to view?");
    await sheet.getByRole("button", { name: "Send enquiry" }).click();
    await expect(sheet.getByText("Enquiry sent")).toBeVisible({ timeout: 30_000 });
    await expect(sheet.getByRole("heading", { name: "What happens next" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Create an account" })).toBeVisible();
  });

  test("a guest can send a general enquiry from the contact page", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByTestId("art-general-enquire-sign-in")).toHaveCount(0);
    const band = page.getByTestId("art-gallery-team-band");
    await expect(band.getByRole("link", { name: /^\+44/ })).toHaveAttribute("href", /^tel:/);
    await expect(band.getByRole("link", { name: /opens in a new tab/ })).toHaveAttribute(
      "target",
      "_blank",
    );
    await page.getByTestId("art-general-enquire-trigger").click();

    const sheet = page.getByRole("dialog", { name: "Send an enquiry" });
    await sheet.getByLabel("Name").fill("Grace Hopper");
    await sheet.getByLabel("Email").fill(`grace+${Date.now()}@example.com`);
    await sheet.getByLabel("Message", { exact: true }).fill("Do you offer private viewings?");
    await sheet.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByTestId("art-general-enquire-sent")).toBeVisible({ timeout: 30_000 });
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

    const heart = card.getByRole("button", { name: /^Save .* to favourites$/ });
    const initiallySaved = (await heart.getAttribute("aria-pressed")) === "true";
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", String(!initiallySaved));
    await expect(heart).not.toHaveAttribute("aria-busy", "true");

    await page.reload();
    const reloaded = page
      .getByTestId("art-artwork-card")
      .first()
      .getByRole("button", { name: /^Save .* to favourites$/ });
    await expect(reloaded).toHaveAttribute("aria-pressed", String(!initiallySaved));

    await reloaded.click();
    await expect(reloaded).toHaveAttribute("aria-pressed", String(initiallySaved));
  });

  test("collection and payouts live in LAX Account, not on lax.art", async ({ request }) => {
    for (const path of ["/account/collection", "/account/payouts"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(308);
      expect(response.headers().location, path).toMatch(/\/account\/(portfolio|selling\/payouts)$/);
    }
  });

  test("a buyer's account overview leads with enquiries and has no seller tools", async ({
    page,
  }) => {
    const credentials = artBuyerCredentials();
    test.skip(!credentials, "nav assertion needs ART_E2E_BUYER_EMAIL and ART_E2E_BUYER_PASSWORD");
    await signInArtBuyer(page, credentials as NonNullable<typeof credentials>, "/account");
    const accountNav = page.getByRole("navigation", { name: "Account sections" });
    await expect(accountNav.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(accountNav.getByRole("link", { name: "Enquiries" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Your enquiries" })).toBeVisible();
    const rows = page.getByTestId("art-account-destinations");
    await expect(
      rows.getByRole("link", { name: /Manage your details in LAX Account/ }),
    ).toBeVisible();
    await expect(rows.getByRole("link", { name: /Payouts/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Your collection", exact: true })).toHaveCount(0);
  });

  test("favourites tabs are signed-in routes", async ({ page }) => {
    await expectSignInRedirect(page, "/account/favourites", "/account/favourites");
    await expectSignInRedirect(page, "/account/favourites/follows", "/account/favourites/follows");
    await expectSignInRedirect(page, "/account/enquiries", "/account/enquiries");

    const credentials = artBuyerCredentials();
    test.skip(!credentials, "tab assertions need ART_E2E_BUYER_EMAIL and ART_E2E_BUYER_PASSWORD");
    await signInArtBuyer(
      page,
      credentials as NonNullable<typeof credentials>,
      "/account/favourites",
    );
    const tabs = page.getByRole("navigation", { name: "Favourites sections" });
    await expect(tabs.getByRole("link", { name: "Saves" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "Follows" }).click();
    await expect(page).toHaveURL(/\/account\/favourites\/follows$/);
  });

  test("dark mode toggle persists across reloads", async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "chromium-mobile";
    const toggleTheme = async () => {
      if (mobile) await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("button", { name: /Switch to (dark|light) theme/ })
        .first()
        .click();
      if (mobile) await page.keyboard.press("Escape");
    };
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const html = page.locator("html");
    const startedDark = await html.evaluate((el) => el.classList.contains("dark"));
    await toggleTheme();
    await expect
      .poll(() => html.evaluate((el) => el.classList.contains("dark")))
      .toBe(!startedDark);

    await page.reload();
    await expect
      .poll(() => html.evaluate((el) => el.classList.contains("dark")))
      .toBe(!startedDark);

    await toggleTheme();
    await expect.poll(() => html.evaluate((el) => el.classList.contains("dark"))).toBe(startedDark);
  });

  test("desktop header offers Sign in, Enquire and keyboard mega menus", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "mega menus are lg+ only");
    await page.goto("/artworks");
    const header = page.getByTestId("art-header");
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fartworks",
    );
    await expect(header.getByRole("link", { name: "Enquire" })).toHaveAttribute("href", "/contact");

    const primary = header.getByRole("navigation", { name: "Primary" });
    await expect(primary.getByRole("link", { name: "Art Hub" })).toHaveAttribute(
      "href",
      "/art-hub",
    );
    const exhibitions = primary.getByRole("button", { name: "Exhibitions" });
    // Without catalogue data every item degrades to a plain link.
    test.skip((await exhibitions.count()) === 0, "header catalogue data unavailable");

    await exhibitions.focus();
    await page.keyboard.press("ArrowDown");
    await expect(exhibitions).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#art-header-megamenu");
    await expect(panel.getByRole("link", { name: "Current" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(panel.getByRole("link", { name: "Upcoming" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(exhibitions).toHaveAttribute("aria-expanded", "false");
    await expect(exhibitions).toBeFocused();
  });

  test("header search shelf submits, remembers the query and closes on Escape", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "inline search is desktop-only");
    await page.goto("/");
    const trigger = page.getByTestId("art-header").getByRole("button", { name: "Search" });
    await trigger.click();
    const shelf = page.getByRole("dialog", { name: "Search" });
    const input = shelf.getByRole("textbox", { name: "Search" });
    await expect(input).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(shelf).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await input.fill("zzqx-no-such-artwork-9271");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=zzqx-no-such-artwork-9271/);

    await trigger.click();
    await expect(shelf.getByRole("link", { name: "zzqx-no-such-artwork-9271" })).toBeVisible();
    await shelf.getByRole("button", { name: "Clear all" }).click();
    await expect(shelf.getByRole("heading", { name: "Recent searches" })).toHaveCount(0);
  });

  test("home header is transparent over the hero, solid after scrolling and while search is open", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const header = page.getByTestId("art-header");
    await expect(header).toHaveAttribute("data-chrome-variant", "transparentUntilScroll");
    await expect(header).toHaveAttribute("data-at-top", "true");
    await expect(header).toHaveAttribute("data-header-tone", "on-dark");
    await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    // The hero starts at the top of the page, under the fixed header, with no gap above it.
    const hero = page.locator("main section").first();
    expect((await hero.boundingBox())?.y).toBe(0);

    if (testInfo.project.name === "chromium-desktop") {
      await header.getByRole("button", { name: "Search" }).click();
      await expect(header).toHaveAttribute("data-header-tone", "on-light");
      await page.keyboard.press("Escape");
      await expect(header).toHaveAttribute("data-header-tone", "on-dark");
    }

    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveAttribute("data-at-top", "false");
    await expect(header).toHaveAttribute("data-header-tone", "on-light");
    await expect(header).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveAttribute("data-at-top", "true");
  });

  test("a page without a hero keeps the header solid", async ({ page }) => {
    await page.goto("/search");
    const header = page.getByTestId("art-header");
    await expect(header).toHaveAttribute("data-chrome-variant", "solid");
    await expect(header).toHaveAttribute("data-header-tone", "on-light");
  });

  test("footer carries the Figma columns in the shared order", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    // Account and LAX products depend on sign-in and product directory config.
    const titles = await footer.getByRole("heading", { level: 3 }).allTextContents();
    expect(titles.slice(0, 2)).toEqual(["Gallery", "Our services"]);
    expect(titles.slice(-2)).toEqual(["Legal", "Connect"]);
    // Columns fold on phones, so links are checked whether or not their column is open.
    await expect(
      footer.getByRole("link", { name: "How to sell", includeHidden: true }),
    ).toHaveAttribute("href", "/how-to-sell");
    await expect(
      footer.getByRole("link", { name: "Contact", includeHidden: true }),
    ).toHaveAttribute("href", "/contact");
  });

  test("mobile bottom nav marks the current tab", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "bottom nav is mobile-only");
    await page.goto("/search");
    const nav = page.getByTestId("art-mobile-bottom-nav");
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveText(["Home", "Discover", "Favourites", "Account"]);
    await expect(nav.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("mobile menu drawer lists primary nav and guest auth, and Escape returns focus", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "menu drawer is below lg only");
    await page.goto("/artworks");
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();

    const drawer = page.getByRole("dialog", { name: "Site navigation" });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("navigation", { name: "Main menu" }).getByRole("link"),
    ).toHaveText(["Artists", "Artworks", "Exhibitions", "Art Hub", "Collecting"]);
    await expect(drawer.getByRole("link", { name: "Artworks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(drawer.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fartworks",
    );
    await expect(drawer.getByRole("link", { name: "Create account" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("session status pages offer Sign in again with a safe return path", async ({ page }) => {
    await page.goto("/signed-out?returnTo=%2Fartists&state=oidc-noise");
    await expect(page.getByRole("heading", { level: 1, name: "Signed out" })).toBeVisible();
    await expect(page).not.toHaveURL(/state=/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const main = page.locator("#main-content");
    await expect(main.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fartists",
    );
    await expect(main.getByRole("link", { name: "Continue browsing" })).toHaveAttribute(
      "href",
      "/artworks",
    );

    await page.goto("/session-expired?returnTo=https%3A%2F%2Fevil.example");
    await expect(page.getByRole("heading", { level: 1, name: "Session expired" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Faccount",
    );
  });
});
