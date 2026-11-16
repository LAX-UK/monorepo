import type { Browser, CDPSession, Page } from "@playwright/test";

/**
 * Motion check: the measurements every motion PR attaches as proof (docs/design/motion.md, MO14).
 *
 * Each helper answers one question and takes a plain Playwright `Page`, so it works against any
 * LAX product. Nothing here changes the page except `throttleCpu` and `useReducedMotion`, which
 * set browser emulation and are undone with the page.
 *
 *  - `observeLayoutShift` / `layoutShiftScore`   did anything jump? (total layout shift, budget 0.1)
 *  - `measureInteractionToPaint`                 how long from a press to the next painted frame?
 *  - `observeViewTransitions` / `viewTransitions`  which view transitions started, and what each one animates?
 *  - `medianInputToTransitionReady`              how long from the input to the transition's first frame?
 *  - `useReducedMotion` / `movingAnimations`     does reduced motion remove all movement?
 *  - `restingScreenshotParity` / `screenshotDiffRatio`  is the page at rest the same with and without JS?
 */

/** The budgets from the spec, so specs do not repeat the numbers. */
export const MOTION_BUDGETS = {
  /** Cumulative layout shift must not exceed this. */
  layoutShift: 0.1,
  /** A press must paint its answer within this, at 4x CPU slowdown. Measured in the page, a trivial
   * page at 4x answers in about 15 ms, so 200 ms leaves more than 10x margin; assert on the
   * median of several presses (`medianInteractionToPaint`), never a single sample. */
  interactionToPaintMs: 200,
  /** The CPU slowdown the spec measures interactions at. */
  cpuSlowdown: 4,
} as const;

type MotionWindow = Window & {
  __motionCheck?: { shift: number; inputAt: number | null; paintedAt: number | null };
};

/**
 * Starts counting layout shift for every page this `page` loads from now on. Call it before
 * `goto`. Reports the total layout shift (the sum of every shift, which is stricter than CLS's largest
 * session window); shifts within 500 ms of input are expected and not counted.
 */
export async function observeLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { shift: 0, inputAt: null as number | null, paintedAt: null as number | null };
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
 * Both ends are stamped inside the page, so neither Playwright's protocol round trip nor the time
 * `action` takes to resolve is counted. The clock starts at the input event's own `timeStamp`.
 * The listener then asks for a frame (`requestAnimationFrame`, which runs before the next paint)
 * and stamps from a `setTimeout(0)` queued inside it, which runs after that frame has been
 * produced. The result is the page's own input-to-next-paint time, under whatever CPU throttle is
 * active. It is read back only after the stamp exists.
 */
export async function measureInteractionToPaint(
  page: Page,
  action: () => Promise<void>,
  inputType: "pointerdown" | "keydown" = "pointerdown",
): Promise<number> {
  await page.evaluate((type) => {
    const w = window as MotionWindow;
    const state = w.__motionCheck ?? { shift: 0, inputAt: null, paintedAt: null };
    w.__motionCheck = state;
    state.inputAt = null;
    state.paintedAt = null;
    window.addEventListener(
      type,
      (event) => {
        state.inputAt = event.timeStamp;
        requestAnimationFrame(() => {
          setTimeout(() => {
            state.paintedAt = performance.now();
          }, 0);
        });
      },
      { capture: true, once: true },
    );
  }, inputType);
  await action();
  try {
    await page.waitForFunction(() => {
      const state = (window as MotionWindow).__motionCheck;
      return state != null && (state.paintedAt !== null || state.inputAt === null);
    });
  } catch {
    // fall through to the error below
  }
  const times = await page.evaluate(() => {
    const state = (window as MotionWindow).__motionCheck;
    return state ? { inputAt: state.inputAt, paintedAt: state.paintedAt } : null;
  });
  if (times === null || times.inputAt === null) {
    throw new Error(`the action dispatched no ${inputType} event`);
  }
  if (times.paintedAt === null) throw new Error("the page did not paint after the input");
  return times.paintedAt - times.inputAt;
}

/**
 * The median of `runs` measurements (default 5), so one slow frame does not decide a budget.
 * `release` undoes the interaction between runs (for example `page.mouse.up()`).
 */
export async function medianInteractionToPaint(
  page: Page,
  action: () => Promise<void>,
  options: {
    inputType?: "pointerdown" | "keydown";
    runs?: number;
    release?: () => Promise<void>;
  } = {},
): Promise<number> {
  const runs = options.runs ?? 5;
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    samples.push(await measureInteractionToPaint(page, action, options.inputType));
    await options.release?.();
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] as number;
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

type ContextOptions = NonNullable<Parameters<Browser["newContext"]>[0]>;

/** The share of pixels that may differ between two healthy renders (anti-aliasing, subpixel text). */
export const RESTING_PARITY_MAX_DIFF_RATIO = 0.001;

/**
 * Screenshots `path` at rest with JavaScript disabled and enabled, in the same browser and
 * viewport, with motion reduced so nothing is mid-fade, the clock frozen, and fonts and the
 * network settled. The page at rest must not depend on JavaScript (server HTML shows all
 * content), so the two must match: compare them with `screenshotDiffRatio` against
 * `RESTING_PARITY_MAX_DIFF_RATIO`, not byte for byte.
 *
 * `contextOptions` are the project's `use` options (`baseURL`, `storageState`, `locale`,
 * `colorScheme`, `extraHTTPHeaders`); pass them so both renders match the page under test.
 * A relative `path` needs a `baseURL` there or a page that has already navigated.
 */
export async function restingScreenshotParity(
  page: Page,
  path: string,
  options: { viewport?: { width: number; height: number }; contextOptions?: ContextOptions } = {},
): Promise<RestingScreenshots> {
  const browser = page.context().browser();
  if (!browser) throw new Error("restingScreenshotParity needs a browser-launched page");
  const viewport = options.viewport ?? page.viewportSize() ?? { width: 1440, height: 900 };
  const base =
    options.contextOptions?.baseURL ?? (page.url() === "about:blank" ? undefined : page.url());
  let target: string;
  try {
    target = new URL(path, base).href;
  } catch {
    throw new Error(
      "restingScreenshotParity needs an absolute path, a baseURL in contextOptions, or a page that has already navigated",
    );
  }

  const shoot = async (javaScriptEnabled: boolean): Promise<Buffer> => {
    const context = await browser.newContext({
      ...options.contextOptions,
      javaScriptEnabled,
      viewport,
      reducedMotion: "reduce",
    });
    try {
      const tab = await context.newPage();
      await tab.clock.setFixedTime(new Date("2026-01-01T12:00:00Z"));
      await tab.goto(target, { waitUntil: "networkidle" });
      if (javaScriptEnabled) await tab.evaluate(() => document.fonts.ready.then(() => undefined));
      return await tab.screenshot({ animations: "disabled", caret: "hide" });
    } finally {
      await context.close();
    }
  };

  return { withoutJs: await shoot(false), withJs: await shoot(true) };
}

/**
 * The share (0 to 1) of pixels that differ between two PNGs of the same size, compared in the
 * browser. Differently sized images count as entirely different (1).
 */
export async function screenshotDiffRatio(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ({ left, right }) => {
      const load = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [x, y] = await Promise.all([load(left), load(right)]);
      if (x.width !== y.width || x.height !== y.height) return 1;
      let differing = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        const delta =
          Math.abs((x.data[i] ?? 0) - (y.data[i] ?? 0)) +
          Math.abs((x.data[i + 1] ?? 0) - (y.data[i + 1] ?? 0)) +
          Math.abs((x.data[i + 2] ?? 0) - (y.data[i + 2] ?? 0));
        if (delta > 24) differing++;
      }
      return differing / (x.width * x.height);
    },
    { left: a.toString("base64"), right: b.toString("base64") },
  );
}

/** What a started view transition animated, read when its first frame was ready. */
export type ViewTransitionRecord = {
  /** `data-view-transition` on the root when the transition's first frame was ready ("none" when
   * unset: the public page change). The app marks a kind inside the update callback. */
  kind: string;
  /** The transition pseudo-element animations: `pseudo` as the browser names it, the CSS animation `name` and `duration` in ms. */
  animations: { pseudo: string; name: string; duration: number }[];
  /** `timeStamp` of the last key or pointer input before the transition started, if any. */
  inputAt: number | null;
  /** `performance.now()` when the transition's `ready` promise resolved (its first frame). */
  readyAt: number | null;
  /** True when the browser skipped the transition (`ready` rejected). */
  skipped: boolean;
};

type TransitionWindow = Window & { __viewTransitions?: ViewTransitionRecord[] };

/**
 * Records every view transition the page starts from now on: its kind, the pseudo-element
 * animations the browser actually runs once the transition is ready, and when its first frame was
 * ready. Call it before `goto`; read the result with `viewTransitions`.
 */
export async function observeViewTransitions(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as TransitionWindow;
    const records: ViewTransitionRecord[] = [];
    w.__viewTransitions = records;
    let lastInput: number | null = null;
    for (const type of ["keydown", "pointerdown", "pointerup"]) {
      window.addEventListener(
        type,
        (event) => {
          lastInput = event.timeStamp;
        },
        { capture: true },
      );
    }
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    document.startViewTransition = ((update?: () => void) => {
      const record: ViewTransitionRecord = {
        kind: document.documentElement.getAttribute("data-view-transition") ?? "none",
        animations: [],
        inputAt: lastInput,
        readyAt: null,
        skipped: false,
      };
      records.push(record);
      const transition = original(update);
      transition.ready.then(
        () => {
          record.readyAt = performance.now();
          record.kind = document.documentElement.getAttribute("data-view-transition") ?? "none";
          record.animations = document
            .getAnimations()
            .map((animation) => {
              const effect = animation.effect as KeyframeEffect | null;
              const pseudo = effect?.pseudoElement ?? "";
              const duration = Number(effect?.getTiming().duration ?? 0);
              return { pseudo, name: (animation as CSSAnimation).animationName ?? "", duration };
            })
            .filter((a) => a.pseudo.startsWith("::view-transition"));
        },
        () => {
          record.skipped = true;
        },
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}

/** The transitions recorded so far, once each has either become ready or been skipped. */
export async function viewTransitions(page: Page): Promise<ViewTransitionRecord[]> {
  await page.waitForFunction(() => {
    const records = (window as TransitionWindow).__viewTransitions;
    return records?.every((r) => r.readyAt !== null || r.skipped) ?? false;
  });
  return page.evaluate(() => (window as TransitionWindow).__viewTransitions ?? []);
}

/**
 * The median time, over `runs` page changes (default 5), from the input that starts a page change
 * to the first frame of its view transition: the user-visible answer, not the press itself.
 * `prepare` puts the page in its starting state before each run (load the list, focus the tile);
 * `perform` is the input (a key press or click that navigates). Needs `observeViewTransitions`.
 */
export async function medianInputToTransitionReady(
  page: Page,
  options: { prepare: () => Promise<void>; perform: () => Promise<void>; runs?: number },
): Promise<number> {
  const runs = options.runs ?? 5;
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    await options.prepare();
    await page.evaluate(() => {
      ((window as TransitionWindow).__viewTransitions ?? []).length = 0;
    });
    await options.perform();
    const [record] = await viewTransitions(page);
    if (!record || record.skipped || record.readyAt === null || record.inputAt === null) {
      throw new Error("the input did not start a view transition that painted");
    }
    samples.push(record.readyAt - record.inputAt);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] as number;
}
