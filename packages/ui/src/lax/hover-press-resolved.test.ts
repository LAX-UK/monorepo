import { readFileSync } from "node:fs";
import type { Browser, Page } from "@playwright/test";
import { afterAll, it as baseIt, beforeAll, describe, expect } from "vitest";
import {
  HOVER_PRESS_SOURCE,
  LAX_SYSTEM_CSS,
  launch,
  pageWith,
  staffTokenBlock,
} from "../test/motion-browser.js";

/**
 * Card hover and button press as Chromium plays them from the real stylesheets (docs/design/
 * motion.md, MO9, MO10 and MO13). Each case loads the tokens, the staff token scope and
 * hover-press.css, emulates the motion preference (and, for a phone, touch with no hover), moves a
 * real mouse over a card or holds it down on a button, and reads what the browser runs: the
 * transitions and animations, their durations, and the values they end on. Nothing is matched
 * against the stylesheet's text, so a changed rule changes a result.
 */
const CSS = `${LAX_SYSTEM_CSS}\n${staffTokenBlock()}\n${HOVER_PRESS_SOURCE}`;

type Who = "public" | "staff" | "account";
type Mode = "none" | "os-reduce" | "force-reduce" | "force-allow-os-reduce";
const WHO: Who[] = ["public", "staff", "account"];
const MODES: Mode[] = ["none", "os-reduce", "force-reduce", "force-allow-os-reduce"];

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** A card the way the kit marks one, a button that presses, a disabled one, and somewhere else. */
function body(who: Who): string {
  const shell =
    who === "staff" ? 'data-staff-ui data-lax-density="staff"' : 'data-lax-density="client"';
  return `<div ${shell}>
    <a href="#card" class="lax-card lax-card-lift" data-probe="card"
       style="display:block;width:320px;padding:8px;border:1px solid #888;color:#111;text-decoration:none">
      <div class="lax-card-media" style="overflow:hidden;width:200px;height:120px">
        <img data-probe="media-img" src="${PIXEL}" alt="" width="200" height="120">
      </div>
      <div style="overflow:hidden;width:200px;height:60px">
        <span class="lax-card-zoom" data-probe="zoom" style="display:block;height:60px;background:#ccc"></span>
      </div>
      <span class="lax-card-title" data-probe="title" style="display:block">Untitled, 1962</span>
      <span data-probe="fact" style="display:block">Estimate £1,000 – 1,500</span>
    </a>
    <button type="button" class="lax-press" data-probe="button" style="margin:8px;width:120px;height:44px">Place bid</button>
    <button type="button" class="lax-press" data-probe="disabled" disabled style="margin:8px;width:120px;height:44px">Closed</button>
    <button type="button" class="lax-press" data-probe="aria-disabled" aria-disabled="true" style="margin:8px;width:120px;height:44px">Wait</button>
    <div data-probe="away" style="height:200px"></div>
  </div>`;
}

function htmlAttributes(who: Who, mode: Mode): string {
  const reduce = mode === "force-reduce" ? ' data-reduce-motion="force-reduce"' : "";
  const allow = mode === "force-allow-os-reduce" ? ' data-reduce-motion="force-allow"' : "";
  const product = who === "account" ? ' data-lax-product="account"' : "";
  return `${reduce}${allow}${product}`;
}

type Probe = {
  translate: string;
  scale: string;
  underline: boolean;
  /** Running transitions by property, in ms. */
  transitions: Record<string, number>;
  /** Running CSS animations by name, in ms. */
  animations: Record<string, number>;
};

/** What runs on a probe now, then the values it ends on once every running animation finishes. */
async function probe(page: Page, id: string): Promise<Probe> {
  return page.evaluate((name) => {
    const el = document.querySelector(`[data-probe="${name}"]`) as HTMLElement;
    const transitions: Record<string, number> = {};
    const animations: Record<string, number> = {};
    for (const animation of el.getAnimations()) {
      const duration = Number(animation.effect?.getTiming().duration ?? 0);
      if (animation instanceof CSSTransition) transitions[animation.transitionProperty] = duration;
      else if (animation instanceof CSSAnimation) animations[animation.animationName] = duration;
      animation.finish();
    }
    const style = getComputedStyle(el);
    return {
      translate: style.translate,
      scale: style.scale,
      underline: style.textDecorationLine.includes("underline"),
      transitions,
      animations,
    };
  }, id);
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

const reducedFor = (mode: Mode) => mode === "os-reduce" || mode === "force-reduce";
const osReduce = (mode: Mode) =>
  mode === "os-reduce" || mode === "force-allow-os-reduce" ? "reduce" : "no-preference";

/** The design: who moves, and how far. */
function moves(who: Who, mode: Mode): boolean {
  return who !== "staff" && !reducedFor(mode);
}

async function open(who: Who, mode: Mode, touch = false): Promise<Page> {
  return pageWith(browser, {
    css: CSS,
    body: body(who),
    htmlAttributes: htmlAttributes(who, mode),
    reducedMotion: osReduce(mode),
    touch,
  });
}

describe("nothing moves or hides at rest", () => {
  for (const who of WHO) {
    it(`${who}: at rest the card, its media and title are untouched and every fact shows`, async () => {
      const page = await open(who, "none");
      try {
        for (const id of ["card", "media-img", "zoom", "title", "button"]) {
          const rest = await probe(page, id);
          expect(rest, id).toMatchObject({ translate: "none", scale: "none", underline: false });
          expect(rest.transitions, id).toEqual({});
          expect(rest.animations, id).toEqual({});
        }
        const fact = await page.locator('[data-probe="fact"]').evaluate((el) => {
          const style = getComputedStyle(el);
          return { visibility: style.visibility, opacity: style.opacity, display: style.display };
        });
        expect(fact).toEqual({ visibility: "visible", opacity: "1", display: "block" });
      } finally {
        await page.close();
      }
    });
  }
});

describe("card hover with a mouse", () => {
  for (const who of WHO) {
    for (const mode of MODES) {
      it(`${who}, ${mode}`, async () => {
        const page = await open(who, mode);
        try {
          await page.hover('[data-probe="card"]');
          const card = await probe(page, "card");
          const img = await probe(page, "media-img");
          const zoom = await probe(page, "zoom");
          const title = await probe(page, "title");
          const fact = await probe(page, "fact");

          // The title underline is a change of state, so it shows for everyone, in every mode.
          expect(title.underline).toBe(true);
          expect(fact.underline).toBe(false);

          if (moves(who, mode)) {
            expect(card.transitions.translate).toBe(260);
            expect(card.translate).toBe("0px -1px");
            for (const media of [img, zoom]) {
              expect(media.transitions.scale).toBe(700);
              expect(media.scale).toBe("1.02");
            }
          } else {
            expect(card.translate).toBe("none");
            expect(card.transitions.translate).toBeUndefined();
            for (const media of [img, zoom]) {
              expect(media.scale).toBe("none");
              expect(media.transitions.scale).toBeUndefined();
            }
          }

          // Leaving lets go again.
          await page.hover('[data-probe="away"]');
          expect((await probe(page, "card")).translate).toBe("none");
          expect((await probe(page, "media-img")).scale).toBe("none");
          expect((await probe(page, "title")).underline).toBe(false);
        } finally {
          await page.close();
        }
      });
    }
  }

  it("a phone (touch, no hover, coarse pointer) gets no lift, zoom or underline", async () => {
    const page = await open("public", "none", true);
    try {
      const media = await page.evaluate(() => ({
        hover: matchMedia("(hover: hover)").matches,
        fine: matchMedia("(pointer: fine)").matches,
      }));
      expect(media).toEqual({ hover: false, fine: false });
      await page.tap('[data-probe="card"]');
      expect(await probe(page, "card")).toMatchObject({ translate: "none", transitions: {} });
      expect(await probe(page, "media-img")).toMatchObject({ scale: "none", transitions: {} });
      expect((await probe(page, "title")).underline).toBe(false);
    } finally {
      await page.close();
    }
  });
});

describe("button press", () => {
  for (const who of WHO) {
    for (const mode of MODES) {
      it(`${who}, ${mode}`, async () => {
        const page = await open(who, mode);
        try {
          await page.hover('[data-probe="button"]');
          await page.mouse.down();
          const held = await probe(page, "button");
          if (moves(who, mode)) {
            expect(held.animations).toEqual({ "lax-press": 100 });
            expect(held.scale).toBe("0.98");
          } else {
            expect(held.animations).toEqual({});
            expect(held.scale).toBe("none");
          }
          await page.mouse.up();
          const released = await probe(page, "button");
          expect(released.scale).toBe("none");
          expect(released.animations).toEqual({});
        } finally {
          await page.close();
        }
      });
    }
  }

  for (const id of ["disabled", "aria-disabled"]) {
    it(`a ${id} button does not press`, async () => {
      const page = await open("public", "none");
      try {
        await page.hover(`[data-probe="${id}"]`, { force: true });
        await page.mouse.down();
        expect(await probe(page, id)).toMatchObject({ scale: "none", animations: {} });
        await page.mouse.up();
      } finally {
        await page.close();
      }
    });
  }
});

/**
 * Shop applies the tokens to its own print lift (apps/shop): the print rises 4px over
 * `--lax-motion-panel` under a mouse, never on a phone, and not at all under reduced motion.
 */
describe("Shop print lift", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const SHOP_CSS = `${LAX_SYSTEM_CSS}\n${read("../../../../apps/shop/src/app/edition-card.css")}\n${read("../../../../apps/shop/src/app/home.css")}`;
  const SHOP_BODY = `
    <a href="#e" class="shop-edition-card" data-probe="edition" style="display:block;position:relative;width:300px;height:300px">
      <span class="shop-edition-card__print" data-probe="edition-print"></span>
    </a>
    <a href="#c" class="shop-collection" data-probe="collection" style="display:block;width:300px;height:200px">
      <span class="shop-collection__print" data-probe="collection-print" style="height:100px"></span>
    </a>
    <div data-probe="away" style="height:200px"></div>`;

  const transformY = (page: Page, id: string) =>
    page.evaluate((name) => {
      const el = document.querySelector(`[data-probe="${name}"]`) as HTMLElement;
      const running = el.getAnimations().map((a) => {
        const duration = Number(a.effect?.getTiming().duration ?? 0);
        a.finish();
        return { property: (a as CSSTransition).transitionProperty, duration };
      });
      return { transform: getComputedStyle(el).transform, running };
    }, id);

  for (const [card, print] of [
    ["edition", "edition-print"],
    ["collection", "collection-print"],
  ] as const) {
    it(`${card}: 4px over the panel token with a mouse`, async () => {
      const page = await pageWith(browser, { css: SHOP_CSS, body: SHOP_BODY });
      try {
        expect((await transformY(page, print)).transform).toBe("none");
        await page.hover(`[data-probe="${card}"]`);
        expect(await transformY(page, print)).toEqual({
          transform: "matrix(1, 0, 0, 1, 0, -4)",
          running: [{ property: "transform", duration: 260 }],
        });
      } finally {
        await page.close();
      }
    });

    it(`${card}: still under reduced motion and on a phone`, async () => {
      for (const options of [{ reducedMotion: "reduce" as const }, { touch: true }]) {
        const page = await pageWith(browser, { css: SHOP_CSS, body: SHOP_BODY, ...options });
        try {
          if (options.touch) await page.tap(`[data-probe="${card}"]`);
          else await page.hover(`[data-probe="${card}"]`);
          expect(await transformY(page, print)).toEqual({ transform: "none", running: [] });
        } finally {
          await page.close();
        }
      }
    });
  }
});
