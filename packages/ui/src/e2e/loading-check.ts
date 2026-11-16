import type { Page, Route } from "@playwright/test";

/**
 * Loading-screen check (docs/design/motion.md, MO12 and MO14), for any LAX product built on the
 * Next app router. It opens `from`, then navigates in the app to `to` while holding the server's
 * answer for `to`, so the route's `loading.tsx` is on screen for as long as the check wants. It
 * reads what the skeleton does while it waits, then lets the answer through and reads what the
 * swap does.
 *
 *  - `skeletonShift`  layout shift while the skeleton waits, fades in and pulses (must be 0)
 *  - `swapShift`      layout shift from the moment the page starts replacing the skeleton
 *  - `hiddenAtStart`  every skeleton block was still invisible when the loading screen appeared
 *  - `nonOpacity`     any skeleton animation that sets something other than opacity
 *
 * Shifts are counted in the page (PerformanceObserver `layout-shift`, input-caused shifts left
 * out), the same way `observeLayoutShift` in apps/web/e2e/helpers/motion-check.ts counts them.
 */
export type LoadingCheck = {
  skeletonShift: number;
  swapShift: number;
  hiddenAtStart: boolean;
  blocks: number;
  nonOpacity: string[];
};

type ShiftWindow = Window & { __loadingShift?: { value: number } };

/** Counts layout shift for every document this page loads; call before the first `goto`. */
export async function countLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { value: 0 };
    (window as ShiftWindow).__loadingShift = state;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) state.value += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function takeShift(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = (window as ShiftWindow).__loadingShift;
    if (!state) throw new Error("call countLayoutShift(page) before page.goto");
    const value = state.value;
    state.value = 0;
    return value;
  });
}

/**
 * Holds the in-app navigation request for `pathname` (the RSC request the router sends on a
 * click, not its prefetch) until the returned `release` is called.
 */
export async function holdNavigation(page: Page, pathname: string): Promise<() => void> {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const matcher = (url: URL) => url.pathname === pathname;
  const handler = async (route: Route) => {
    const headers = route.request().headers();
    if (headers.rsc === "1" && !headers["next-router-prefetch"]) await released;
    await route.continue().catch(() => {});
  };
  await page.route(matcher, handler);
  return () => {
    release();
  };
}

/**
 * Prefetches `href` the way a visible `<Link>` does, so the router holds the route's loading
 * boundary and can show it while the navigation itself is held. A route a link on screen has
 * already prefetched sends no second request; the wait then gives up after 10 seconds.
 */
async function prefetchLoadingBoundary(page: Page, href: string, pathname: string): Promise<void> {
  const prefetched = page
    .waitForResponse(
      (response) =>
        new URL(response.url()).pathname === pathname &&
        response.request().headers()["next-router-prefetch"] === "1",
      { timeout: 10_000 },
    )
    .catch(() => null);
  await page.evaluate((to) => {
    // `kind: "auto"` is what a `<Link>` does: the route up to its loading boundary. A bare
    // `prefetch(href)` asks for the full page, which the navigation then waits on instead.
    const next = (
      window as unknown as {
        next?: { router?: { prefetch: (h: string, o: { kind: string }) => void } };
      }
    ).next;
    next?.router?.prefetch(to, { kind: "auto" });
  }, href);
  await prefetched;
}

/**
 * Navigates the app router to `href` the way a visitor does: a real click on a control that
 * pushes the route, as a `<Link>` would. Because the click is input, the browser does not count
 * the old page giving way to the loading screen as layout shift (it happens within 500ms of the
 * click), exactly as on a real visit; everything after that is counted.
 */
export async function navigateInApp(page: Page, href: string): Promise<void> {
  await page.evaluate((to) => {
    const next = (window as unknown as { next?: { router?: { push: (h: string) => void } } }).next;
    if (!next?.router) throw new Error("the Next app router is not on this page");
    const go = document.createElement("button");
    go.type = "button";
    go.id = "__loading-check-go";
    go.textContent = "Go";
    go.style.cssText =
      "position:fixed;left:0;bottom:0;z-index:2147483647;width:8px;height:8px;opacity:0";
    go.addEventListener("click", () => next.router?.push(to), { once: true });
    document.body.append(go);
  }, href);
  await page.locator("#__loading-check-go").click();
}

/** Every skeleton animation's properties, and whether every block is still invisible. */
async function readSkeleton(
  page: Page,
): Promise<{ blocks: number; hidden: boolean; nonOpacity: string[] }> {
  return page.evaluate(() => {
    // Only blocks that are drawn: one hidden at this width (`lg:hidden`) has no animation.
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(".lax-skeleton")).filter(
      (block) => block.getClientRects().length > 0,
    );
    const nonOpacity = new Set<string>();
    for (const block of blocks) {
      for (const animation of block.getAnimations()) {
        for (const frame of (animation.effect as KeyframeEffect).getKeyframes()) {
          for (const key of Object.keys(frame)) {
            if (!["offset", "computedOffset", "easing", "composite", "opacity"].includes(key)) {
              nonOpacity.add(`${(animation as CSSAnimation).animationName}: ${key}`);
            }
          }
        }
      }
    }
    return {
      blocks: blocks.length,
      hidden: blocks.every((block) => Number.parseFloat(getComputedStyle(block).opacity) === 0),
      nonOpacity: [...nonOpacity],
    };
  });
}

/**
 * Shows `to`'s loading screen (navigating from `from`), keeps it up for `holdMs` (long enough
 * for the delay, the fade-in and a full pulse), then lets the page in and waits for it to settle.
 * `whileLoading` runs with the loading screen up, for screenshots.
 */
export async function checkLoadingScreen(
  page: Page,
  options: {
    from: string;
    to: string;
    holdMs?: number;
    settleMs?: number;
    whileLoading?: (() => Promise<void>) | undefined;
  },
): Promise<LoadingCheck> {
  const pathname = new URL(options.to, "http://lax.invalid").pathname;
  await page.goto(options.from);
  await page.waitForLoadState("networkidle");
  const release = await holdNavigation(page, pathname);
  await prefetchLoadingBoundary(page, options.to, pathname);
  await takeShift(page);

  await navigateInApp(page, options.to);
  await page.locator(".lax-skeleton").first().waitFor({ state: "attached" });
  // A block of the loading screen itself: the swap is over when it has left the page. (The page
  // can draw `.lax-skeleton` too, for an image that has not loaded, so "no skeleton left" is not
  // the test.)
  const screenBlock = await page.locator(".lax-skeleton").first().elementHandle();
  const first = await readSkeleton(page);
  // From here on every shift counts: the delay, the fade-in and more than one full pulse.
  await page.waitForTimeout(options.holdMs ?? 2_200);
  const later = await readSkeleton(page);
  await options.whileLoading?.();
  const skeletonShift = await takeShift(page);

  release();
  await page.waitForURL((url) => url.pathname === pathname);
  await page.waitForFunction((block) => !block?.isConnected, screenBlock, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(options.settleMs ?? 1_000);
  const swapShift = await takeShift(page);
  await page.unroute((url) => url.pathname === pathname);

  return {
    skeletonShift,
    swapShift,
    hiddenAtStart: first.hidden,
    blocks: later.blocks,
    nonOpacity: [...new Set([...first.nonOpacity, ...later.nonOpacity])],
  };
}

/**
 * Holds every skeleton animation at the moment the block is fully drawn (after the delay and the
 * fade, before the pulse dims it), so a screenshot of a loading screen is the same on every run.
 */
export async function freezeSkeletons(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const block of Array.from(document.querySelectorAll<HTMLElement>(".lax-skeleton"))) {
      for (const animation of block.getAnimations()) {
        animation.pause();
        const timing = animation.effect?.getComputedTiming();
        animation.currentTime = Number(timing?.delay ?? 0) + Number(timing?.duration ?? 0);
      }
    }
  });
}

export type LoadingScreenCase = {
  /** What the case is called in the report and the screenshot file names. */
  name: string;
  /** A page to start from; the check navigates from it in the app. */
  from: string;
  /** The route whose loading screen is checked. */
  to: string;
  /**
   * Puts the product in the state the page should be measured in before the check starts (for
   * Shop's basket, a basket with an item in it, so the swap is measured against the full page).
   */
  prepare?: (page: Page) => Promise<void>;
  /**
   * Why this case's swap shift is reported but not held to the 0.1 budget: only for a shift the
   * loading screen does not cause (say, a server redirect the framework follows with a blank frame).
   * Every skeleton check still runs. Name the cause and where it is tracked.
   */
  swapNotAsserted?: string;
};

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "375", width: 375, height: 812 },
] as const;

/**
 * One test per loading screen, viewport (1440, 375) and colour scheme (light, dark): no layout
 * shift while the skeleton waits, fades in and pulses; the skeleton animates opacity only; the swap
 * to the page stays within the layout shift budget (0.1). With `LOADING_SCREENSHOTS=<dir>` it
 * also saves each loading screen at rest. Call it inside the spec's own tagged `test.describe`
 * (the e2e tag check reads the spec file). Opt-in (`PLAYWRIGHT_LOADING_CHECK=1`): it needs the
 * product running with seeded data.
 */
export function defineLoadingScreenTests(
  test: typeof import("@playwright/test").test,
  expect: typeof import("@playwright/test").expect,
  product: string,
  cases: readonly LoadingScreenCase[],
): void {
  test.skip(
    process.env.PLAYWRIGHT_LOADING_CHECK !== "1",
    "Set PLAYWRIGHT_LOADING_CHECK=1 and PLAYWRIGHT_BASE_URL with the product running.",
  );
  // Each case sets its own viewports, so a phone-emulating project would only repeat them.
  test.skip(({ isMobile }) => isMobile, "Viewports are set per case.");
  const shots = process.env.LOADING_SCREENSHOTS;

  for (const viewport of VIEWPORTS) {
    for (const scheme of ["light", "dark"] as const) {
      for (const item of cases) {
        test(`${item.name} at ${viewport.name}, ${scheme}`, async ({ page }) => {
          test.setTimeout(90_000);
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          // A fresh visitor whose system is set to this scheme: the product's own theme script
          // and server render pick it up, as they would on a real first visit.
          await page.emulateMedia({ colorScheme: scheme });
          await countLayoutShift(page);
          await item.prepare?.(page);
          const result = await checkLoadingScreen(page, {
            from: item.from,
            to: item.to,
            whileLoading: shots
              ? async () => {
                  await freezeSkeletons(page);
                  await page.screenshot({
                    path: `${shots}/${product}-${item.name}-${viewport.name}-${scheme}.png`,
                  });
                }
              : undefined,
          });
          test
            .info()
            .annotations.push({ type: "loading-check", description: JSON.stringify(result) });
          expect(result.blocks, "skeleton blocks on the loading screen").toBeGreaterThan(0);
          expect(result.nonOpacity, "skeleton animations other than opacity").toEqual([]);
          expect(result.skeletonShift, "layout shift while the skeleton shows").toBe(0);
          if (item.swapNotAsserted) {
            test
              .info()
              .annotations.push({ type: "swap-not-asserted", description: item.swapNotAsserted });
          } else {
            expect(result.swapShift, "layout shift when the page replaces it").toBeLessThanOrEqual(
              0.1,
            );
          }
        });
      }
    }
  }
}
