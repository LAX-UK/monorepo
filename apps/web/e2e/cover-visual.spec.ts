import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { formatAxeViolations, stabilizeVisualPage } from "./helpers/auth";

const e2eEnabled = process.env.PLAYWRIGHT_E2E === "1";
const visualEnabled = process.env.PLAYWRIGHT_VISUAL === "1";
const skipReason =
  "Set PLAYWRIGHT_E2E=1 and PLAYWRIGHT_VISUAL=1, and serve apps/web with COVER_FIXTURE_REVIEW=1 " +
  "(a production build answers 404 on /dev/cover without it).";

/**
 * The home cover on fixture data, so the images are the same on every run (inline artwork, no
 * live photographs). Each state is the fixture of that id on /dev/cover.
 */
const STATES = [
  { slug: "photo", fixture: "live" },
  { slug: "plate", fixture: "no-cover" },
  { slug: "between-seasons", fixture: "between" },
  { slug: "text-only", fixture: "no-images" },
] as const;

const VIEWPORTS = [
  { slug: "desktop", width: 1440, height: 900 },
  { slug: "mobile", width: 375, height: 812 },
] as const;

const SCHEMES = ["light", "dark"] as const;

test.describe("home cover visual states @optin", () => {
  test.setTimeout(60_000);

  for (const state of STATES) {
    for (const viewport of VIEWPORTS) {
      for (const colorScheme of SCHEMES) {
        test(`${state.slug} ${viewport.slug} ${colorScheme}`, async ({ page }) => {
          test.skip(!e2eEnabled || !visualEnabled, skipReason);
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
          const res = await page.goto(`/dev/cover?only=${state.fixture}`);
          expect(res?.ok(), "the fixture page is served").toBeTruthy();

          const cover = page.locator(`#${state.fixture}`);
          await expect(cover).toBeVisible();
          await stabilizeVisualPage(page);
          await page.evaluate(() => document.fonts.ready);

          await expect(cover).toHaveScreenshot(
            `cover-${state.slug}-${viewport.slug}-${colorScheme}.png`,
            { maxDiffPixelRatio: 0.01 },
          );
        });
      }
    }
  }

  for (const state of STATES) {
    test(`${state.slug} has no serious accessibility violations`, async ({ page }) => {
      test.skip(!e2eEnabled || !visualEnabled, skipReason);
      await page.goto(`/dev/cover?only=${state.fixture}`);
      await expect(page.locator(`#${state.fixture}`)).toBeVisible();
      const result = await new AxeBuilder({ page })
        .include(`#${state.fixture}`)
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const blocking = result.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      );
      expect(
        blocking,
        blocking.length > 0 ? `Axe violations:\n${formatAxeViolations(blocking)}` : undefined,
      ).toHaveLength(0);
    });
  }
});
