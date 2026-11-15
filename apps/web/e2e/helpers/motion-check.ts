import type { CDPSession, Page } from "@playwright/test";

/**
 * Motion check: the measurements every motion PR attaches as proof (docs/design/motion.md, MO14).
 *
 * Each helper answers one question and takes a plain Playwright `Page`, so it works against any
 * LAX product. Nothing here changes the page except `throttleCpu` and `useReducedMotion`, which
 * set browser emulation and are undone with the page.
 *
 *  - `observeLayoutShift` / `layoutShiftScore`   did anything jump? (CLS, budget 0.1)
 *  - `measureInteractionToPaint`                 how long from a press to the next painted frame?
 *  - `useReducedMotion` / `movingAnimations`     does reduced motion remove all movement?
 *  - `restingScreenshotParity`                   is the page at rest the same with and without JS?
 */

/** The budgets from the spec, so specs do not repeat the numbers. */
export const MOTION_BUDGETS = {
  /** Cumulative layout shift must not exceed this. */
  layoutShift: 0.1,
  /** A press must paint its answer within this, at 4x CPU slowdown. */
  interactionToPaintMs: 200,
  /** The CPU slowdown the spec measures interactions at. */
  cpuSlowdown: 4,
} as const;

type MotionWindow = Window & {
  __motionCheck?: { shift: number; inputAt: number | null };
};

/**
 * Starts counting layout shift for every page this `page` loads from now on. Call it before
 * `goto`. Shifts within 500 ms of input are expected and not counted, as in CLS.
 */
export async function observeLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { shift: 0, inputAt: null as number | null };
    (window as MotionWindow).__motionCheck = state;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) state.shift += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** The layout shift counted so far (needs `observeLayoutShift` before navigation). */
export async function layoutShiftScore(page: Page): Promise<number> {
  const score = await page.evaluate(() => (window as MotionWindow).__motionCheck?.shift);
  if (score === undefined) throw new Error("call observeLayoutShift(page) before page.goto");
  return score;
}

/** Slows the page's CPU by `rate` (4 = the spec's 4x) through the Chrome DevTools protocol. */
export async function throttleCpu(
  page: Page,
  rate: number = MOTION_BUDGETS.cpuSlowdown,
): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
  return session;
}

/**
 * Time from the browser receiving the input an `action` performs to the next painted frame, in
 * milliseconds. `action` does the scripted interaction (a click, a key press); `inputType` is the
 * event it dispatches first (`pointerdown` for a click or tap, `keydown` for a key).
 *
 * The clock starts at the input event's own timestamp, so Playwright's round trip is not counted.
 * The end is the second animation frame after the action settles, when the answer has painted.
 */
export async function measureInteractionToPaint(
  page: Page,
  action: () => Promise<void>,
  inputType: "pointerdown" | "keydown" = "pointerdown",
): Promise<number> {
  await page.evaluate((type) => {
    const w = window as MotionWindow;
    const state = w.__motionCheck ?? { shift: 0, inputAt: null };
    w.__motionCheck = state;
    state.inputAt = null;
    window.addEventListener(
      type,
      (event) => {
        state.inputAt = event.timeStamp;
      },
      { capture: true, once: true },
    );
  }, inputType);
  await action();
  const elapsed = await page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const inputAt = (window as MotionWindow).__motionCheck?.inputAt ?? null;
            resolve(inputAt === null ? null : performance.now() - inputAt);
          }),
        );
      }),
  );
  if (elapsed === null) throw new Error(`the action dispatched no ${inputType} event`);
  return elapsed;
}

/** Turns on `prefers-reduced-motion: reduce` for the page. */
export async function useReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
}

/** Properties whose animation is movement (everything reduced motion must remove). */
const MOVEMENT = /^(transform|translate|scale|rotate|offset|top|left|right|bottom|margin|inset)/;

/**
 * Animations running right now that move something, or loop forever, as `name: properties`.
 * Under reduced motion public products may still fade (opacity) but must return `[]` here;
 * staff tools and LAX Account must have no running animation of any kind (`includeFades`).
 */
export async function movingAnimations(
  page: Page,
  options: { includeFades?: boolean } = {},
): Promise<string[]> {
  return page.evaluate(
    ({ movement, includeFades }) => {
      const isMovement = new RegExp(movement);
      return document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .flatMap((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          if (!effect) return [];
          const properties = [
            ...new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame))),
          ].filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p));
          const loops = effect.getComputedTiming().iterations === Number.POSITIVE_INFINITY;
          const moves = properties.some((p) => isMovement.test(p));
          if (!(moves || loops || includeFades)) return [];
          const name = (animation as CSSAnimation).animationName ?? "transition";
          return [`${name}: ${properties.join(", ")}`];
        });
    },
    { movement: MOVEMENT.source, includeFades: options.includeFades ?? false },
  );
}

/** The resting page, rendered once with JavaScript off and once on, as PNG bytes. */
export type RestingScreenshots = { withoutJs: Buffer; withJs: Buffer };

/**
 * Screenshots `path` at rest with JavaScript disabled and enabled, in the same browser and
 * viewport, with motion reduced so nothing is mid-fade. The page at rest must not depend on
 * JavaScript (server HTML shows all content), so the two must be identical: compare with
 * `expect(withJs.equals(withoutJs)).toBe(true)`.
 */
export async function restingScreenshotParity(
  page: Page,
  path: string,
  options: { viewport?: { width: number; height: number } } = {},
): Promise<RestingScreenshots> {
  const browser = page.context().browser();
  if (!browser) throw new Error("restingScreenshotParity needs a browser-launched page");
  const viewport = options.viewport ?? page.viewportSize() ?? { width: 1440, height: 900 };
  const baseURL = new URL(path, page.url() === "about:blank" ? undefined : page.url()).href;

  const shoot = async (javaScriptEnabled: boolean): Promise<Buffer> => {
    const context = await browser.newContext({
      javaScriptEnabled,
      viewport,
      reducedMotion: "reduce",
    });
    try {
      const tab = await context.newPage();
      await tab.goto(baseURL, { waitUntil: "load" });
      return await tab.screenshot({ animations: "disabled", caret: "hide" });
    } finally {
      await context.close();
    }
  };

  return { withoutJs: await shoot(false), withJs: await shoot(true) };
}
