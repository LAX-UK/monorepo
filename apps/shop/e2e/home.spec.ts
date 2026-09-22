import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { settleVisualPage } from "./settle-visual-page";
import { applyShopThemeForE2e, syncShopThemeForE2e } from "./shop-theme-e2e";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL (default http://localhost:3020), and start Shop (pnpm --filter @auction/shop dev).";

function formatAxeViolations(
  violations: ReadonlyArray<{ id: string; impact?: string | null; help: string }>,
) {
  return violations.map((v) => `  - ${v.id} (${v.impact ?? "?"}): ${v.help}`).join("\n");
}

test.describe("Shop home @a11y", () => {
  test("responds, exposes main landmark, and passes whole-page axe", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "whole-page axe once on desktop");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const res = await page.goto("/");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("#main-content")).toBeVisible();

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const blocking = axe.violations.filter((v) =>
      ["critical", "serious", "moderate"].includes(v.impact ?? ""),
    );
    expect(blocking, `Axe on Shop home:\n${formatAxeViolations(blocking)}`).toEqual([]);
  });

  test("shows forward rail affordance when a home row overflows", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop rail affordance only");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const printsRail = page.locator("#prints-rail");
    await expect(printsRail).toBeVisible();
    const overflow = await printsRail.evaluate((el) => el.scrollWidth - el.clientWidth > 4);
    test.skip(!overflow, "Prints rail has no overflow in this viewport");
    const forward = page.getByRole("button", { name: "Scroll to see more prints and multiples" });
    await expect(forward).toBeVisible();
    await forward.focus();
    await expect(forward).toBeFocused();
    const before = await printsRail.evaluate((el) => el.scrollLeft);
    await forward.click();
    await expect
      .poll(async () => printsRail.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(before);
  });

  test("mobile menu exposes account actions and closes with Escape", async ({ page }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-mobile", "mobile drawer only");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const openMenu = page.getByRole("button", { name: "Open menu", exact: true });
    await openMenu.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const mobileAccount = dialog.locator(".shop-header__mobile-account");
    await expect(mobileAccount).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Create account" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Account menu" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(openMenu).toBeVisible();
    await expect(openMenu).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps storefront content visible without JavaScript", async ({ browser }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "no-JS contract once on desktop");
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const firstReveal = page.locator(".reveal").first();
    await expect(firstReveal).toBeVisible();
    await expect(firstReveal).not.toHaveAttribute("data-reveal-init", "true");
    await context.close();
  });

  test("renders seeded, navigable cards for every catalogue section", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "home catalogue cards once on desktop");
    await page.goto("/");

    await expect(page.locator(".shop-home__original-card").first()).toHaveAttribute(
      "href",
      /\/artworks\//,
    );
    await expect(page.locator(".shop-home__category-card").first()).toHaveAttribute(
      "href",
      /\/categories\//,
    );
    await expect(page.locator(".shop-home__print-card").first()).toHaveAttribute(
      "href",
      /\/artworks\//,
    );
    await expect(page.locator(".shop-home__artist-card").first()).toHaveAttribute(
      "href",
      /\/artists\//,
    );
  });

  test("aligns Prints with other rails and matches Category to Artist footprints", async ({
    page,
  }, testInfo) => {
    test.skip(!enabled, skipReason);
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop geometry only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const originals = await page.locator(".shop-home__original-card").first().boundingBox();
    const prints = await page.locator(".shop-home__print-card").first().boundingBox();
    expect(originals).toBeTruthy();
    expect(prints).toBeTruthy();
    expect(Math.abs((originals?.x ?? 0) - (prints?.x ?? 0))).toBeLessThan(2);

    const categoryImage = await page.locator(".shop-home__category-image").first().boundingBox();
    const artistImage = await page.locator(".shop-home__artist-image").first().boundingBox();
    const categoryCard = await page.locator(".shop-home__category-card").first().boundingBox();
    const artistCard = await page.locator(".shop-home__artist-card").first().boundingBox();
    expect(categoryImage).toBeTruthy();
    expect(artistImage).toBeTruthy();
    expect(Math.abs((categoryImage?.width ?? 0) - (artistImage?.width ?? 0))).toBeLessThan(4);
    expect(Math.abs((categoryImage?.height ?? 0) - (artistImage?.height ?? 0))).toBeLessThan(4);
    expect(Math.abs((categoryCard?.width ?? 0) - (artistCard?.width ?? 0))).toBeLessThan(4);
  });
});

test.describe("Shop home @visual", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`desktop baseline (${theme})`, async ({ page }, testInfo) => {
      test.skip(!enabled || process.env.PLAYWRIGHT_VISUAL !== "1", skipReason);
      test.skip(testInfo.project.name !== "chromium-desktop", "desktop visual only");
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await applyShopThemeForE2e(page, theme);
      await page.goto("/");
      await expect(page.locator("#main-content")).toBeVisible();
      await syncShopThemeForE2e(page, theme);
      if (theme === "dark") {
        await expect(page.locator("html")).toHaveClass(/dark/);
      } else {
        await expect(page.locator("html")).not.toHaveClass(/dark/);
      }
      await settleVisualPage(page);
      await expect(page).toHaveScreenshot(`shop-home-desktop-${theme}.png`, { fullPage: true });
    });

    test(`mobile baseline (${theme})`, async ({ page }, testInfo) => {
      test.skip(!enabled || process.env.PLAYWRIGHT_VISUAL !== "1", skipReason);
      test.skip(testInfo.project.name !== "chromium-mobile", "mobile visual only");
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await applyShopThemeForE2e(page, theme);
      await page.goto("/");
      await expect(page.locator("#main-content")).toBeVisible();
      await syncShopThemeForE2e(page, theme);
      if (theme === "dark") {
        await expect(page.locator("html")).toHaveClass(/dark/);
      } else {
        await expect(page.locator("html")).not.toHaveClass(/dark/);
      }
      await settleVisualPage(page);
      await expect(page.locator("#main-content")).toHaveScreenshot(`shop-home-mobile-${theme}.png`);
    });
  }
});
