import type { Page, Route } from "@playwright/test";
import {
  artBuyerCredentials,
  artE2eEnabled,
  artE2eSkipReason,
  signInArtBuyer,
} from "./helpers/art-e2e";
import { expect, test } from "./helpers/test";

/**
 * The root layout's HTML is shared between visitors (it reads no cookies, so the home page can be
 * prerendered), and the browser reads who the visitor is from /api/viewer. While that read is in
 * flight a signed-in visitor must see nothing move and nothing of a guest's: the header account
 * slot, the phone tab bar and the footer Account list keep one footprint for every visitor and
 * stay hidden until the answer lands.
 *
 * The read is held open on purpose, so the window is long enough to look at. With the seeded
 * buyer (ART_E2E_BUYER_EMAIL) the visitor is really signed in and the held request then goes to
 * the server; without it the answer is a signed-in snapshot.
 */
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "375", width: 375, height: 812 },
] as const;

/** The prerendered home, and a page rendered per request. */
const PAGES = ["/", "/artworks"] as const;

const SIGNED_IN_SNAPSHOT = {
  account: {
    kind: "authenticated",
    displayName: "Christopher Ashdown",
    email: "collector@example.test",
    accountHref: "/account",
    logoutHref: "/logout",
  },
  replyDot: true,
};

const CHROME = {
  header: '[data-testid="art-header"]',
  accountSlot: '[data-testid="art-header-account-slot"]',
  tabBar: '[data-testid="art-bottom-tab-bar"]',
  footerAccount: '[data-testid="art-footer-account-list"]',
} as const;

type Box = { x: number; y: number; width: number; height: number } | null;

declare global {
  interface Window {
    __artChromeShifts?: { value: number; inChrome: boolean }[];
  }
}

/** Every layout shift from the first paint, and whether it moved anything in the chrome. */
async function recordLayoutShifts(page: Page) {
  await page.addInitScript((selectors: string[]) => {
    window.__artChromeShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      }[]) {
        if (entry.hadRecentInput) continue;
        const inChrome = (entry.sources ?? []).some((source) => {
          const node = source.node;
          const element = node instanceof Element ? node : node?.parentElement;
          return selectors.some((selector) => element?.closest(selector));
        });
        window.__artChromeShifts?.push({ value: entry.value, inChrome });
      }
    }).observe({ type: "layout-shift", buffered: true });
  }, Object.values(CHROME));
}

async function chromeBoxes(page: Page): Promise<Record<keyof typeof CHROME, Box>> {
  const entries = await Promise.all(
    (Object.keys(CHROME) as (keyof typeof CHROME)[]).map(async (key) => {
      const locator = page.locator(CHROME[key]).first();
      // Scroll position is the same before and after, so page coordinates compare as they are.
      return [key, (await locator.count()) > 0 ? await locator.boundingBox() : null] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<keyof typeof CHROME, Box>;
}

/** Holds /api/viewer until `release` is called. */
async function holdViewerRead(page: Page, answer: "server" | "snapshot") {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/viewer", async (route: Route) => {
    await released;
    if (answer === "server") await route.continue();
    else await route.fulfill({ json: SIGNED_IN_SNAPSHOT });
  });
  return release;
}

test.describe("lax.art account chrome while the visitor is read @smoke", () => {
  test.skip(!artE2eEnabled, artE2eSkipReason);

  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`a signed-in visitor sees no shift and no guest control on ${path} at ${viewport.name}`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "chromium-desktop", "sizes are set by the test");
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const buyer = artBuyerCredentials();
        if (buyer) await signInArtBuyer(page, buyer, "/");
        await recordLayoutShifts(page);
        const release = await holdViewerRead(page, buyer ? "server" : "snapshot");

        const requested = page.waitForRequest("**/api/viewer");
        await page.goto(path);
        await expect(page.locator(CHROME.footerAccount)).toHaveAttribute(
          "data-account-ready",
          "false",
        );
        // The read starts once the page has hydrated: from here on this is what the visitor sees
        // while it is in flight.
        await requested;
        // Nothing of a guest's is drawn: no "Account" trigger, no Sign in in the footer.
        await expect(page.getByRole("button", { name: "Account menu", exact: true })).toHaveCount(
          0,
        );
        await expect(page.locator(CHROME.footerAccount).locator("a:visible")).toHaveCount(0);
        if (viewport.width < 768) {
          await expect(
            page.locator(CHROME.tabBar).getByRole("link", { name: "Account" }),
          ).toHaveAttribute("href", "/account");
        }
        const before = await chromeBoxes(page);
        await testInfo.attach(`pending-${viewport.name}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });

        release();
        await expect(page.locator(CHROME.footerAccount)).toHaveAttribute(
          "data-account-ready",
          "true",
        );
        await expect(
          // On a phone the footer columns fold, so the link is found by its text, not its role.
          page
            .locator(CHROME.footerAccount)
            .locator("a", { hasText: "Your account" }),
        ).toHaveCount(1);
        if (viewport.width >= 1024) {
          await expect(page.locator(CHROME.accountSlot)).toHaveAttribute(
            "data-account-ready",
            "true",
          );
          await expect(page.getByTestId("account-entry-name")).toBeVisible();
        }
        const after = await chromeBoxes(page);
        await testInfo.attach(`settled-${viewport.name}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });

        expect(after, "the chrome keeps its place when the visitor lands").toEqual(before);
        const shifts = await page.evaluate(() => window.__artChromeShifts ?? []);
        const chromeShift = shifts
          .filter((shift) => shift.inChrome)
          .reduce((sum, shift) => sum + shift.value, 0);
        expect(chromeShift, "layout shift in the header, tab bar or footer").toBe(0);
      });
    }
  }
});
