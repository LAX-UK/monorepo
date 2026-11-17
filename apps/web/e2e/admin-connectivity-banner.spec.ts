import type { Page } from "@playwright/test";
import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  gotoAdminPath,
} from "./helpers/auth";
import { expect, test } from "./helpers/auth.fixture";

/**
 * Staff pages: the browser-offline banner sits under the staff top bar (not the marketing header's
 * offset), overlays the page, and never moves the top bar or makes the page taller.
 */

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "375", width: 375, height: 812 },
] as const;

async function readStaffLayout(page: Page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    };
    return {
      // The shell's top bar: the sticky header (page headers inside <main> scroll with the page).
      topBar: box(
        [...document.querySelectorAll("[data-staff-shell] header")].find(
          (h) => getComputedStyle(h).position === "sticky",
        ) ?? null,
      ),
      banner: box(document.querySelector('[data-testid="browser-offline-banner"]')),
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

test.describe("staff connectivity banner @smoke", () => {
  test.skip(!e2eEnabled, e2eSkipReason);

  for (const viewport of VIEWPORTS) {
    test(`${viewport.label}: offline banner sits under the staff top bar without moving it`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoAdminPath(page, "/admin");
      await dismissStaffPaletteIfOpen(page);
      await expect(page.locator("[data-staff-shell] header").first()).toBeVisible();
      const online = await readStaffLayout(page);

      await page.context().setOffline(true);
      try {
        await expect(page.getByTestId("browser-offline-banner")).toBeVisible();
        const offline = await readStaffLayout(page);

        expect(offline.topBar?.top).toBe(0);
        expect(offline.topBar).toEqual(online.topBar);
        expect(
          Math.abs((offline.banner?.top ?? -1) - (offline.topBar?.bottom ?? 0)),
        ).toBeLessThanOrEqual(1);
        expect(offline.scrollHeight).toBe(online.scrollHeight);
      } finally {
        await page.context().setOffline(false);
      }
    });
  }
});
