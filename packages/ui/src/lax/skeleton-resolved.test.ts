import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Browser, Page } from "@playwright/test";
import { afterAll, it as baseIt, beforeAll, describe, expect } from "vitest";
import {
  LAX_SYSTEM_CSS,
  SKELETON_SOURCE,
  launch,
  pageWith,
  staffTokenBlock,
} from "../test/motion-browser.js";

/**
 * The loading skeleton as Chromium plays it (docs/design/motion.md, MO12 and MO13), from the real
 * stylesheets: the LAX tokens, the staff token scope and skeleton.css. Each case pauses the
 * skeleton's animations and seeks them to a moment after it was drawn, then reads the computed
 * opacity and box. Nothing here reads the stylesheet's text, so a changed rule changes a result.
 *
 *  - Delay: nothing shows for the first 150ms, so a fast load draws nothing.
 *  - Pulse: then an opacity pulse every 1.6s, opacity only, forever.
 *  - Reduced motion: the delay stays, the pulse goes; public products keep a fade of at most
 *    150ms, the staff tools and LAX Account appear at once.
 *  - The block keeps its box throughout, so neither the skeleton nor its pulse shifts the page.
 */
const CSS = `${LAX_SYSTEM_CSS}\n${staffTokenBlock()}\n${SKELETON_SOURCE}`;

type Who = "public" | "staff" | "account";
type Mode = "none" | "os-reduce" | "force-reduce" | "force-allow-os-reduce";
const WHO: Who[] = ["public", "staff", "account"];
const MODES: Mode[] = ["none", "os-reduce", "force-reduce", "force-allow-os-reduce"];

const reducedMode = (mode: Mode) => mode === "os-reduce" || mode === "force-reduce";

function htmlAttributes(who: Who, mode: Mode): string {
  const reduce = mode === "force-reduce" ? ' data-reduce-motion="force-reduce"' : "";
  const allow = mode === "force-allow-os-reduce" ? ' data-reduce-motion="force-allow"' : "";
  const product = who === "account" ? ' data-lax-product="account"' : "";
  return `${reduce}${allow}${product}`;
}

/** The page shell: the staff shell sets `data-lax-density="staff"`, the others client density. */
function body(who: Who): string {
  const density =
    who === "staff" ? 'data-staff-ui data-lax-density="staff"' : 'data-lax-density="client"';
  return `<div ${density}><div class="lax-skeleton" id="bone" style="width:320px;height:24px;background:#888"></div><p id="below">Below</p></div>`;
}

async function open(browser: Browser, who: Who, mode: Mode): Promise<Page> {
  return pageWith(browser, {
    css: CSS,
    body: body(who),
    htmlAttributes: htmlAttributes(who, mode),
    reducedMotion:
      mode === "os-reduce" || mode === "force-allow-os-reduce" ? "reduce" : "no-preference",
  });
}

type Played = {
  name: string;
  /** Milliseconds, as resolved from the tokens. */
  duration: number;
  delay: number;
  iterations: number;
  properties: string[];
  /** The timing function each keyframe interval plays (a CSS animation's `animation-timing-function`). */
  easings: string[];
};

/** Every animation Chromium runs on the skeleton, with its resolved timing and keyframe properties. */
async function animations(page: Page): Promise<Played[]> {
  return page.evaluate(() => {
    const bone = document.getElementById("bone") as HTMLElement;
    return bone.getAnimations().map((animation) => {
      const effect = animation.effect as KeyframeEffect;
      const timing = effect.getComputedTiming();
      const properties = new Set<string>();
      const easings = new Set<string>();
      for (const frame of effect.getKeyframes()) {
        if (typeof frame.easing === "string") easings.add(frame.easing);
        for (const key of Object.keys(frame)) {
          if (!["offset", "computedOffset", "easing", "composite"].includes(key)) {
            properties.add(key);
          }
        }
      }
      return {
        name: (animation as CSSAnimation).animationName,
        duration: Number(timing.duration),
        delay: Number(timing.delay),
        iterations: Number(timing.iterations),
        properties: [...properties].sort(),
        easings: [...easings].sort(),
      };
    });
  });
}

/** Opacity and box of the skeleton at `ms` after it was drawn, with every animation held there. */
async function at(
  page: Page,
  ms: number,
): Promise<{ opacity: number; top: number; height: number; below: number }> {
  return page.evaluate((time) => {
    const bone = document.getElementById("bone") as HTMLElement;
    for (const animation of bone.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
    const box = bone.getBoundingClientRect();
    return {
      opacity: Number.parseFloat(getComputedStyle(bone).opacity),
      top: box.top,
      height: box.height,
      below: (document.getElementById("below") as HTMLElement).getBoundingClientRect().top,
    };
  }, ms);
}

/** A custom property as the page's root resolves it, normalised the way Chromium writes easings. */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((property) => {
    const probe = document.createElement("div");
    probe.style.transitionTimingFunction = getComputedStyle(document.documentElement)
      .getPropertyValue(property)
      .trim();
    return probe.style.transitionTimingFunction;
  }, name);
}

/** `it`, skipped when this machine has no Chromium (CI requires one). */
const it = ((name: string, fn: () => Promise<void>, timeout?: number) =>
  baseIt(
    name,
    async (ctx) => {
      if (!available) return ctx.skip();
      await fn();
    },
    timeout,
  )) as typeof baseIt;

let browser: Browser;
let available = false;
beforeAll(async () => {
  const launched = await launch();
  available = launched !== null;
  browser = launched as Browser;
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

describe("loading skeleton resolved in Chromium", () => {
  for (const who of WHO) {
    for (const mode of MODES) {
      it(`${who}, motion preference: ${mode}`, async () => {
        const page = await open(browser, who, mode);
        try {
          const played = await animations(page);
          const reduced = reducedMode(mode);
          const instant = reduced && who !== "public";
          // Staff fade at their own --lax-motion-fade (100ms); the others at 120ms.
          const fade = who === "staff" ? 100 : 120;

          const appear = played.find((a) => a.name === "lax-skeleton-in");
          expect(appear, "fade-in").toBeDefined();
          expect(appear).toMatchObject({
            delay: 150,
            duration: instant ? 0 : fade,
            iterations: 1,
            properties: ["opacity"],
          });

          const pulse = played.find((a) => a.name === "lax-skeleton-pulse");
          if (reduced) {
            // Static: no loop of any kind.
            expect(pulse, "pulse under reduced motion").toBeUndefined();
            expect(played.filter((a) => a.iterations === Number.POSITIVE_INFINITY)).toEqual([]);
          } else {
            expect(pulse).toMatchObject({
              duration: 1600,
              delay: 150 + fade,
              iterations: Number.POSITIVE_INFINITY,
              properties: ["opacity"],
            });
            // The pulse's easing is the `--lax-ease-pulse` token as this page resolves it.
            expect(pulse?.easings).toEqual([await token(page, "--lax-ease-pulse")]);
          }
          // Only opacity moves: no transform, no background-position shimmer, no size change.
          for (const animation of played) expect(animation.properties).toEqual(["opacity"]);

          // Hidden through the delay, so a load faster than 150ms shows nothing.
          const early = await at(page, 0);
          const late = await at(page, 140);
          expect(early.opacity).toBe(0);
          expect(late.opacity).toBe(0);

          // Fully drawn once the fade is over and before the pulse dims it.
          const shown = await at(page, 150 + fade + (reduced ? 1 : 0));
          expect(shown.opacity).toBeCloseTo(1, 2);

          // Halfway through a pulse: dimmed, unless reduced motion keeps it still.
          const mid = await at(page, 150 + fade + 800);
          const nextMid = await at(page, 150 + fade + 1600 + 800);
          if (reduced) {
            expect(mid.opacity).toBe(1);
            expect(nextMid.opacity).toBe(1);
          } else {
            expect(mid.opacity).toBeCloseTo(0.55, 2);
            // The next pulse, one 1.6s period later, is the same.
            expect(nextMid.opacity).toBeCloseTo(0.55, 2);
            const cycleEnd = await at(page, 150 + fade + 1600);
            expect(cycleEnd.opacity).toBeCloseTo(1, 2);
          }

          // The box never changes, and nothing after it moves.
          for (const sample of [late, shown, mid, nextMid]) {
            expect(sample.top).toBe(early.top);
            expect(sample.height).toBe(early.height);
            expect(sample.below).toBe(early.below);
          }
        } finally {
          await page.close();
        }
      }, 30_000);
    }
  }

  it("records no layout shift while it waits, fades in and pulses", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.addInitScript(() => {
        (window as unknown as { __shift: number }).__shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { value: number }[]) {
            (window as unknown as { __shift: number }).__shift += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto("about:blank");
      await page.setContent(
        `<!doctype html><html><head><style>${CSS}</style></head><body>${body("public")}</body></html>`,
      );
      // Real time: through the delay, the fade-in and more than one full pulse.
      await page.waitForTimeout(2200);
      const shift = await page.evaluate(() => (window as unknown as { __shift: number }).__shift);
      expect(shift).toBe(0);
      // The fade-in has finished (it holds no end state); the pulse is still running.
      const running = await animations(page);
      expect(running.map((a) => a.name)).toEqual(["lax-skeleton-pulse"]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it("takes the pulse easing from --lax-ease-pulse, not a literal", async () => {
    // A different value for the token must reach the pulse: a literal easing in skeleton.css
    // (say `linear`) would ignore it.
    const custom = "cubic-bezier(0.1, 0.2, 0.3, 0.9)";
    const page = await pageWith(browser, {
      css: `${CSS}\n:root { --lax-ease-pulse: ${custom}; }`,
      body: body("public"),
    });
    try {
      const pulse = (await animations(page)).find((a) => a.name === "lax-skeleton-pulse");
      expect(pulse?.easings).toEqual([custom]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it("reaches every product through the kit's lax-theme.css", async () => {
    // The products import `@auction/ui/lax-theme.css`, not skeleton.css. Load that export the way
    // the browser follows it (its own `@import`s, unknown Tailwind at-rules dropped) and check the
    // skeleton still plays: dropping `@import "./skeleton.css"` from theme.css fails here.
    const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    const themeExport = pkg.exports["./lax-theme.css"];
    expect(typeof themeExport).toBe("string");
    const themeUrl = pathToFileURL(resolve(packageDir, themeExport as string)).href;
    const systemUrl = pathToFileURL(resolve(packageDir, "../branding/public/lax-system.css")).href;
    const dir = mkdtempSync(join(tmpdir(), "lax-theme-"));
    const file = join(dir, "index.html");
    writeFileSync(
      file,
      `<!doctype html><html><head><link rel="stylesheet" href="${systemUrl}"><link rel="stylesheet" href="${themeUrl}"></head><body>${body("public")}</body></html>`,
    );
    const page = await browser.newPage();
    try {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto(pathToFileURL(file).href);
      const names = (await animations(page)).map((a) => a.name).sort();
      expect(names).toEqual(["lax-skeleton-in", "lax-skeleton-pulse"]);
    } finally {
      await page.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
