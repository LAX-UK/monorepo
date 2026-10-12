import { expect, test } from "@playwright/test";
import { artE2eEnabled, artE2eSkipReason } from "./helpers/art-e2e";

const viewports = [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const routes = [
  "/",
  "/artworks",
  "/artworks?view=list",
  "/artworks/tidal-forms",
  "/artists",
  "/exhibitions",
  "/visit",
  "/how-to-buy",
  "/search?q=art",
] as const;

test.describe("lax.art viewport audit @a11y", () => {
  for (const viewport of viewports) {
    for (const route of routes) {
      test(`no horizontal overflow on ${route} at ${viewport.width}px`, async ({
        page,
      }, testInfo) => {
        test.skip(!artE2eEnabled, artE2eSkipReason);
        test.skip(
          testInfo.project.name !== "chromium-desktop",
          "viewport sizes assigned explicitly",
        );
        await page.setViewportSize(viewport);
        await page.goto(route);
        await expect(page.locator("#main-content")).toBeVisible();
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth + 1;
        });
        expect(overflow).toBe(false);
      });
    }
  }
});
