import { type Page, expect, test } from "@playwright/test";
import { resolveSaleRoutes } from "./public-routes";

/**
 * The connectivity banner is part of the header chrome: it shows under the visible header, and
 * the page and every sticky bar under the header (sale tabs, catalogue toolbar) move down by its
 * height instead of sliding beneath it, at the top of the page and while scrolled. Measured as
 * boxes in the real layout, at a desktop and a phone width.
 */

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start the seeded stack.";

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "375", width: 375, height: 812 },
] as const;

/** Half a pixel for subpixel rounding between boxes that touch. */
const EPS = 0.5;

type Box = { top: number; bottom: number };
type Layout = {
  header: Box | null;
  banner: Box | null;
  heading: Box | null;
  tabs: Box | null;
  toolbar: Box | null;
};

/** Every box in one layout pass, after the header has published its offsets for this frame. */
async function readLayout(page: Page): Promise<Layout> {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  return page.evaluate(() => {
    const box = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.height > 0 ? { top: r.top, bottom: r.bottom } : null;
    };
    const sticky = (el: Element | null) => {
      for (let n = el; n; n = n.parentElement) {
        if (getComputedStyle(n).position === "sticky") return n;
      }
      return null;
    };
    const catalog = document.getElementById("catalog");
    return {
      header: box(document.querySelector("body header")),
      // The lowest connectivity banner on screen (browser offline, or the sale's live notice).
      banner:
        [
          box(document.querySelector('[data-testid="browser-offline-banner"]')),
          box(document.querySelector('[data-testid="marketing-live-connectivity-banner"]')),
        ]
          .filter((b) => b != null)
          .sort((a, b) => b.bottom - a.bottom)[0] ?? null,
      heading: box(document.querySelector("#main-content h1")),
      tabs: box(sticky(document.querySelector('nav[aria-label="Sale sections"]'))),
      toolbar: box(
        catalog
          ? ([...catalog.querySelectorAll("div")].find(
              (n) => getComputedStyle(n).position === "sticky",
            ) ?? null)
          : null,
      ),
    };
  });
}

function expectClear(lower: Box | null, upper: Box | null, what: string) {
  expect(lower, `${what}: lower box`).not.toBeNull();
  expect(upper, `${what}: upper box`).not.toBeNull();
  if (!lower || !upper) return;
  expect(lower.top, `${what} (top ${lower.top} vs ${upper.bottom})`).toBeGreaterThanOrEqual(
    upper.bottom - EPS,
  );
}

async function scrollCatalogueUnderHeader(page: Page) {
  await page.evaluate(() => {
    document.getElementById("catalog")?.scrollIntoView({ block: "start", behavior: "instant" });
    window.scrollBy({ top: 240, behavior: "instant" });
  });
}

let salePath: string | null = null;

test.describe("connectivity banner layout @smoke", () => {
  test.skip(!enabled, skipReason);

  test.beforeAll(async ({ request }) => {
    const routes = await resolveSaleRoutes(request);
    // The seeded hybrid sale has a live room, the hang and a full catalogue.
    salePath = (routes.find((r) => r.name === "sale-hybrid") ?? routes[0])?.path ?? null;
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.label}: sale tabs and toolbar are never under the banner`, async ({
      page,
      context,
    }) => {
      test.skip(salePath == null, "No seeded sale");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(salePath as string);
      await expect(page.locator('nav[aria-label="Sale sections"]')).toBeVisible();

      await context.setOffline(true);
      await expect(page.getByTestId("browser-offline-banner")).toBeVisible();

      // Top of the page: the banner sits on the header and the page starts below it.
      const top = await readLayout(page);
      expect(Math.abs((top.banner?.top ?? 0) - (top.header?.bottom ?? -1))).toBeLessThanOrEqual(1);
      expectClear(top.heading, top.banner, "sale heading under the banner at the top");
      expectClear(top.tabs, top.banner, "sale tabs under the banner at the top");

      // Scrolled into the catalogue: the tabs pin under the banner, the toolbar under the tabs.
      await scrollCatalogueUnderHeader(page);
      const scrolled = await readLayout(page);
      expect(
        Math.abs((scrolled.banner?.top ?? 0) - (scrolled.header?.bottom ?? -1)),
      ).toBeLessThanOrEqual(1);
      expectClear(scrolled.tabs, scrolled.banner, "pinned sale tabs under the banner");
      if (scrolled.toolbar) {
        expectClear(scrolled.toolbar, scrolled.tabs, "pinned catalogue toolbar under the tabs");
      }

      // Back online: the offline banner goes and the tabs pin straight under the header chrome
      // again (under the live notice if the saleroom socket is still connecting).
      await context.setOffline(false);
      await expect(page.getByTestId("browser-offline-banner")).toHaveCount(0, {
        timeout: 15_000,
      });
      const restored = await readLayout(page);
      const chromeBottom = restored.banner?.bottom ?? restored.header?.bottom ?? -1;
      expect(Math.abs((restored.tabs?.top ?? 0) - chromeBottom)).toBeLessThanOrEqual(1);
    });

    test(`${viewport.label}: the banner showing while scrolled does not move the content being read`, async ({
      page,
      context,
    }) => {
      test.skip(salePath == null, "No seeded sale");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(salePath as string);
      await expect(page.locator('nav[aria-label="Sale sections"]')).toBeVisible();
      await scrollCatalogueUnderHeader(page);
      await readLayout(page);

      // Whatever is in the middle of the viewport is what the reader is looking at.
      const anchorTop = () =>
        page.evaluate(() => {
          const w = window as unknown as { __anchor?: Element | null };
          w.__anchor ??= document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return w.__anchor?.getBoundingClientRect().top ?? Number.NaN;
        });
      const before = await anchorTop();

      await context.setOffline(true);
      await expect(page.getByTestId("browser-offline-banner")).toBeVisible();
      await readLayout(page);
      await expect
        .poll(async () => Math.abs((await anchorTop()) - before), { timeout: 2_000 })
        .toBeLessThanOrEqual(1);

      await context.setOffline(false);
      await expect(page.getByTestId("browser-offline-banner")).toHaveCount(0, {
        timeout: 15_000,
      });
      await readLayout(page);
      await expect
        .poll(async () => Math.abs((await anchorTop()) - before), { timeout: 2_000 })
        .toBeLessThanOrEqual(1);
    });
  }
});
