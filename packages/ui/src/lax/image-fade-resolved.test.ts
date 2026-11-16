import type { Browser, Page } from "@playwright/test";
import { afterAll, it as baseIt, beforeAll, describe, expect } from "vitest";
import {
  IMAGE_FADE_SOURCE,
  LAX_SYSTEM_CSS,
  launch,
  pageWith,
  staffTokenBlock,
} from "../test/motion-browser.js";

/**
 * The image load fade as Chromium plays it from the real stylesheets (docs/design/motion.md,
 * "Images", MO13 and MO15): the LAX tokens, the staff token scope and image-fade.css, with the
 * `opacity-100` utility as Tailwind 4 builds it (in `@layer utilities`). Each case draws images the
 * way `MediaImage` and the cover draw them, marks them loaded the way those components do (adding
 * `opacity-100`) and reads what the browser shows and runs. Nothing is matched against the
 * stylesheet's text, so a changed rule changes a result.
 *
 *  - First screen: a priority or eager image is visible before it loads and never fades.
 *  - Below the fold: a lazy image waits for its load, then fades in over 200ms, opacity only.
 *  - JavaScript off: nothing marks an image loaded, so a lazy image is shown as it arrives.
 *  - Reduced motion: public products keep a 120ms fade; staff tools and LAX Account show it at once.
 */
const TAILWIND_UTILITY = `@layer components, utilities;
@layer utilities { .opacity-100 { opacity: 100%; } }`;
const CSS = `${LAX_SYSTEM_CSS}\n${staffTokenBlock()}\n${TAILWIND_UTILITY}\n${IMAGE_FADE_SOURCE}`;
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

type Who = "public" | "staff" | "account";
type Mode = "none" | "os-reduce" | "force-reduce" | "force-allow-os-reduce";
const WHO: Who[] = ["public", "staff", "account"];
const MODES: Mode[] = ["none", "os-reduce", "force-reduce", "force-allow-os-reduce"];

function htmlAttributes(who: Who, mode: Mode): string {
  const reduce = mode === "force-reduce" ? ' data-reduce-motion="force-reduce"' : "";
  const allow = mode === "force-allow-os-reduce" ? ' data-reduce-motion="force-allow"' : "";
  const product = who === "account" ? ' data-lax-product="account"' : "";
  return `${reduce}${allow}${product}`;
}

/** A priority image (no `loading`, as next/image draws one), an eager one and a lazy one. */
function body(who: Who): string {
  const density =
    who === "staff" ? 'data-staff-ui data-lax-density="staff"' : 'data-lax-density="client"';
  const img = (id: string, loading: string) =>
    `<img id="${id}" class="lax-image-fade" ${loading} src="${PIXEL}" alt="" width="40" height="40">`;
  return `<div ${density}>${img("priority", 'fetchpriority="high"')}${img("eager", 'loading="eager"')}${img("lazy", 'loading="lazy"')}</div>`;
}

type Seen = {
  opacity: string;
  /** Running transitions by property, with duration (ms) and easing. */
  running: Record<string, { duration: number; easing: string }>;
};

/** What an image shows now, and the transitions running on it. */
function seen(page: Page, id: string): Promise<Seen> {
  return page.evaluate((name) => {
    const el = document.getElementById(name) as HTMLElement;
    const running: Record<string, { duration: number; easing: string }> = {};
    for (const animation of el.getAnimations()) {
      if (!(animation instanceof CSSTransition)) continue;
      const timing = animation.effect?.getComputedTiming();
      running[animation.transitionProperty] = {
        duration: Number(timing?.duration ?? 0),
        easing: String(timing?.easing ?? ""),
      };
    }
    return { opacity: getComputedStyle(el).opacity, running };
  }, id);
}

/** The component marks every image loaded. */
const markLoaded = (page: Page) =>
  page.evaluate(() => {
    for (const img of document.querySelectorAll("img")) img.classList.add("opacity-100");
  });

const finishAll = (page: Page) =>
  page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });

/** The fade a lazy image plays when it loads, for this audience and motion setting (ms). */
function expectedFade(who: Who, mode: Mode): number {
  const reduced = mode === "os-reduce" || mode === "force-reduce";
  if (!reduced) return who === "staff" ? 150 : 200;
  return who === "public" ? 120 : 0;
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
  if (available) await browser.close();
});

async function open(who: Who, mode: Mode): Promise<Page> {
  return pageWith(browser, {
    css: CSS,
    body: body(who),
    htmlAttributes: htmlAttributes(who, mode),
    reducedMotion:
      mode === "os-reduce" || mode === "force-allow-os-reduce" ? "reduce" : "no-preference",
  });
}

describe("first-screen images appear at once", () => {
  for (const who of WHO) {
    for (const mode of MODES) {
      for (const id of ["priority", "eager"] as const) {
        it(`${who}, ${mode}: a ${id} image is visible before it loads and never fades`, async () => {
          const page = await open(who, mode);
          try {
            expect(await seen(page, id)).toEqual({ opacity: "1", running: {} });
            await markLoaded(page);
            expect(await seen(page, id)).toEqual({ opacity: "1", running: {} });
          } finally {
            await page.close();
          }
        });
      }
    }
  }
});

describe("below-the-fold images fade in once loaded", () => {
  for (const who of WHO) {
    for (const mode of MODES) {
      it(`${who}, ${mode}: a lazy image waits, then fades in on opacity only`, async () => {
        const page = await open(who, mode);
        try {
          expect((await seen(page, "lazy")).opacity).toBe("0");
          await markLoaded(page);
          const fade = expectedFade(who, mode);
          const now = await seen(page, "lazy");
          if (fade === 0) {
            expect(now).toEqual({ opacity: "1", running: {} });
          } else {
            expect(now.running).toEqual({
              opacity: { duration: fade, easing: "cubic-bezier(0.2, 0, 0, 1)" },
            });
          }
          await finishAll(page);
          expect((await seen(page, "lazy")).opacity).toBe("1");
        } finally {
          await page.close();
        }
      });
    }
  }
});

describe("JavaScript off", () => {
  it("a lazy image is shown as it arrives: nothing waits for a load mark that never comes", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.setContent(
        `<!doctype html><html><head><style>${CSS}</style></head><body>${body("public")}</body></html>`,
      );
      for (const id of ["priority", "eager", "lazy"]) {
        expect(await seen(page, id)).toEqual({ opacity: "1", running: {} });
      }
    } finally {
      await context.close();
    }
  });
});
