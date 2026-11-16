import type { Browser } from "@playwright/test";
import { afterAll, it as baseIt, beforeAll, describe, expect } from "vitest";
import {
  LAX_SYSTEM_CSS,
  MOTION_SOURCE,
  type ResolvedAnimation,
  SONNER_CSS,
  launch,
  pageWith,
  resolveAnimation,
  staffTokenBlock,
} from "../test/motion-browser.js";

/**
 * What the browser resolves for every overlay layer, from the real stylesheets (docs/design/
 * motion.md, MO8 and MO13). Each case builds a portalled layer the way the kit renders it, loads
 * the tokens, the staff token scope and motion.css, emulates the motion preference and reads the
 * computed animation, its duration and the properties its keyframes move. Nothing here reads the
 * stylesheet's text, so a changed rule changes a result.
 */
const CSS = `${LAX_SYSTEM_CSS}\n${staffTokenBlock()}\n${MOTION_SOURCE}`;

type Kind = "float" | "tip" | "scrim" | "dialog" | "sheet" | "dialog-side";
type Who = "public" | "staff" | "staff-lax-ui" | "account";
type Mode = "none" | "os-reduce" | "force-reduce" | "force-allow-os-reduce";

const KINDS: Kind[] = ["float", "tip", "scrim", "dialog", "sheet", "dialog-side"];
const WHO: Who[] = ["public", "staff", "staff-lax-ui", "account"];
const MODES: Mode[] = ["none", "os-reduce", "force-reduce", "force-allow-os-reduce"];

const isStaff = (who: Who) => who === "staff" || who === "staff-lax-ui";

/**
 * The shell a page renders. The staff shell puts `data-lax-density="staff"` on its root, which is
 * the only thing that scopes the staff motion; the public and account shells are client density.
 */
function shell(who: Who): string {
  return isStaff(who)
    ? '<div data-staff-ui data-lax-density="staff" id="shell"></div>'
    : '<div data-lax-density="client" id="shell"></div>';
}

function attributes(kind: Kind, who: Who, state: "open" | "closed", probe: string): string {
  const motion = kind === "dialog-side" ? "dialog" : kind;
  // A plain kit layer carries nothing but its motion marker, wherever it opens: on a staff page
  // the staff timings reach it through the page scope alone. A LAX UI layer also carries
  // `data-lax-ui` and the density of the place it was opened from.
  const laxUi = who === "staff-lax-ui" ? ' data-lax-density="staff" data-lax-ui' : "";
  const side = kind === "dialog-side" ? ' data-placement="side"' : "";
  const edge =
    kind === "sheet" ? ' data-side="right"' : kind === "float" ? ' data-side="bottom"' : "";
  return `data-probe="${probe}" data-lax-motion="${motion}" data-state="${state}"${laxUi}${side}${edge}`;
}

function htmlAttributes(who: Who, mode: Mode): string {
  const reduce = mode === "force-reduce" ? ' data-reduce-motion="force-reduce"' : "";
  const allow = mode === "force-allow-os-reduce" ? ' data-reduce-motion="force-allow"' : "";
  const product = who === "account" ? ' data-lax-product="account"' : "";
  return `${reduce}${allow}${product}`;
}

type Expected = { name: string; duration: number; moves: boolean };
const NONE: Expected = { name: "none", duration: 0, moves: false };
const fade = (direction: "in" | "out", duration: number): Expected => ({
  name: `lax-fade-${direction}`,
  duration,
  moves: false,
});

/** The design (docs/design/motion.md, MO8 and MO13), written out per kind, audience and mode. */
function expected(kind: Kind, who: Who, mode: Mode, direction: "in" | "out"): Expected {
  const reduced = mode === "os-reduce" || mode === "force-reduce";
  const staff = isStaff(who);
  if (reduced) {
    if (staff || who === "account") return NONE;
    return fade(direction, 120);
  }
  const dir = direction;
  const pick = (inMs: number, outMs: number) => (dir === "in" ? inMs : outMs);
  if (kind === "tip") return fade(dir, staff ? 100 : 120);
  if (kind === "float") {
    return staff
      ? fade(dir, pick(150, 100))
      : { name: `lax-float-${dir}`, duration: pick(200, 140), moves: true };
  }
  if (kind === "scrim") return fade(dir, staff ? pick(200, 150) : pick(260, 180));
  if (staff) return fade(dir, pick(200, 150));
  const name = kind === "dialog" ? `lax-rise-${dir}` : `lax-slide-${dir}`;
  return { name, duration: pick(260, 180), moves: true };
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

function summary(resolved: ResolvedAnimation): Expected {
  return { name: resolved.name, duration: resolved.duration, moves: resolved.moves };
}

describe("overlay animations resolved in Chromium", () => {
  for (const who of WHO) {
    for (const mode of MODES) {
      it(`${who} layers, motion preference: ${mode}`, async () => {
        const body = KINDS.flatMap((kind) =>
          (["open", "closed"] as const).map(
            (state) => `<div ${attributes(kind, who, state, `${kind}-${state}`)}></div>`,
          ),
        ).join("");
        const page = await pageWith(browser, {
          css: CSS,
          body: `${shell(who)}${body}`,
          htmlAttributes: htmlAttributes(who, mode),
          reducedMotion:
            mode === "os-reduce" || mode === "force-allow-os-reduce" ? "reduce" : "no-preference",
        });
        try {
          for (const kind of KINDS) {
            const open = await resolveAnimation(page, `${kind}-open`);
            const closed = await resolveAnimation(page, `${kind}-closed`);
            // Bid's force-allow wins over the OS setting: the same as no preference.
            const effective: Mode = mode === "force-allow-os-reduce" ? "none" : mode;
            expect(summary(open), `${who} ${kind} open (${mode})`).toEqual(
              expected(kind, who, effective, "in"),
            );
            expect(summary(closed), `${who} ${kind} closed (${mode})`).toEqual(
              expected(kind, who, effective, "out"),
            );
            if (effective === "os-reduce" || effective === "force-reduce" || isStaff(who)) {
              // Staff layers fade only; under reduce nothing moves at all.
              expect(open.moves, `${who} ${kind} open moves (${mode})`).toBe(false);
              expect(closed.moves, `${who} ${kind} closed moves (${mode})`).toBe(false);
            }
          }
        } finally {
          await page.close();
        }
      }, 30_000);
    }
  }

  it("a closing layer keeps its end state until Radix unmounts it; an opening one does not", async () => {
    const page = await pageWith(browser, {
      css: CSS,
      body: `<div ${attributes("dialog", "public", "open", "o")}></div><div ${attributes("dialog", "public", "closed", "c")}></div>`,
    });
    try {
      const fill = await page.evaluate(() => ({
        open: getComputedStyle(document.querySelector('[data-probe="o"]') as Element)
          .animationFillMode,
        closed: getComputedStyle(document.querySelector('[data-probe="c"]') as Element)
          .animationFillMode,
      }));
      expect(fill.open).toBe("none");
      expect(fill.closed).toBe("forwards");
    } finally {
      await page.close();
    }
  });

  it("a tooltip that opens straight after another does not animate", async () => {
    const page = await pageWith(browser, {
      css: CSS,
      body: '<div data-probe="t" data-lax-motion="tip" data-state="instant-open"></div>',
    });
    try {
      expect((await resolveAnimation(page, "t")).name).toBe("none");
    } finally {
      await page.close();
    }
  });
});

describe("toasts resolved in Chromium (with Sonner's own stylesheet)", () => {
  const TOAST_CSS = `${LAX_SYSTEM_CSS}\n${staffTokenBlock()}\n${SONNER_CSS}\n${MOTION_SOURCE}`;
  const SONNER_ONLY = SONNER_CSS;

  function toast(
    id: string,
    state: { front: boolean; expanded: boolean; removed?: boolean; swipeOut?: boolean },
    index: number,
  ): string {
    return `<li data-probe="${id}" data-sonner-toast data-styled="true" data-mounted="true" data-visible="true"
      data-y-position="bottom" data-x-position="right" data-front="${state.front}"
      data-expanded="${state.expanded}" data-removed="${state.removed ?? false}"
      data-swipe-out="${state.swipeOut ?? false}" data-swiping="false"
      style="--index:${index};--toasts-before:${index};--z-index:${3 - index};--offset:${index * 60}px;--lift:-1;--lift-amount:calc(var(--lift) * var(--gap));--initial-height:52px;--front-toast-height:52px;--gap:14px">x</li>`;
  }

  function toaster(inner: string): string {
    return `<ol data-sonner-toaster data-y-position="bottom" data-x-position="right" style="--front-toast-height:52px;--gap:14px">${inner}</ol>`;
  }

  /** transform of every probe, with transitions switched off so only the resting position shows. */
  async function transforms(css: string, body: string, ids: string[]): Promise<string[]> {
    const page = await pageWith(browser, {
      css: `${css}\n*{transition:none!important}`,
      body,
    });
    try {
      return await page.evaluate(
        (probes) =>
          probes.map((id) =>
            getComputedStyle(
              document.querySelector(`[data-probe="${id}"]`) as Element,
            ).getPropertyValue("transform"),
          ),
        ids,
      );
    } finally {
      await page.close();
    }
  }

  const stack = (expanded: boolean) =>
    toaster(
      [
        toast("front", { front: true, expanded }, 0),
        toast("middle", { front: false, expanded, removed: true }, 1),
        toast("back", { front: false, expanded }, 2),
      ].join(""),
    );

  for (const expanded of [true, false]) {
    it(`a removed toast behind the front one keeps Sonner's position (stack ${expanded ? "expanded" : "collapsed"})`, async () => {
      const ids = ["front", "middle", "back"];
      const withKit = await transforms(TOAST_CSS, stack(expanded), ids);
      const sonnerAlone = await transforms(SONNER_ONLY, stack(expanded), ids);
      expect(withKit).toEqual(sonnerAlone);
      // Sanity: the removed toast really is displaced from where it sits unremoved.
      expect(withKit[1]).not.toBe("none");
    });
  }

  it("the other toasts of the stack stay where they were while one exits", async () => {
    const page = await pageWith(browser, {
      css: `${TOAST_CSS}\n*{transition:none!important}`,
      body: toaster(
        [
          toast("front", { front: true, expanded: true }, 0),
          toast("second", { front: false, expanded: true }, 1),
          toast("third", { front: false, expanded: true }, 2),
        ].join(""),
      ),
    });
    try {
      const read = () =>
        page.evaluate(() =>
          ["front", "second", "third"].map(
            (id) =>
              getComputedStyle(document.querySelector(`[data-probe="${id}"]`) as Element).transform,
          ),
        );
      const before = await read();
      await page.evaluate(() => {
        const el = document.querySelector('[data-probe="second"]') as HTMLElement;
        el.setAttribute("data-removed", "true");
      });
      const after = await read();
      expect(after[0]).toBe(before[0]);
      expect(after[2]).toBe(before[2]);
    } finally {
      await page.close();
    }
  });

  it("the front toast exits by the toast rise instead of its full height", async () => {
    const [front] = await transforms(
      TOAST_CSS,
      toaster(toast("front", { front: true, expanded: false, removed: true }, 0)),
      ["front"],
    );
    expect(front).toBe("matrix(1, 0, 0, 1, 0, 8)");
    const [swipe] = await transforms(
      TOAST_CSS,
      toaster(toast("swipe", { front: true, expanded: false, removed: true, swipeOut: true }, 0)),
      ["swipe"],
    );
    const [swipeSonner] = await transforms(
      SONNER_ONLY,
      toaster(toast("swipe", { front: true, expanded: false, removed: true, swipeOut: true }, 0)),
      ["swipe"],
    );
    expect(swipe).toBe(swipeSonner);
  });

  type Case = {
    who: "public" | "staff" | "account";
    mode: Mode;
    enter: string;
    exit: string;
    properties: string;
  };
  const cases: Case[] = [
    { who: "public", mode: "none", enter: "0.2s", exit: "0.14s", properties: "transform, opacity" },
    { who: "staff", mode: "none", enter: "0.15s", exit: "0.1s", properties: "transform, opacity" },
    { who: "public", mode: "force-reduce", enter: "0.12s", exit: "0.12s", properties: "opacity" },
    { who: "staff", mode: "force-reduce", enter: "0s", exit: "0s", properties: "none" },
    { who: "account", mode: "force-reduce", enter: "0s", exit: "0s", properties: "none" },
  ];
  for (const c of cases) {
    it(`toast timings: ${c.who}, ${c.mode}`, async () => {
      // The staff toaster carries nothing of its own: the staff shell on the page scopes it.
      const body =
        shell(c.who) +
        toaster(
          toast("shown", { front: true, expanded: false }, 0) +
            toast("leaving", { front: true, expanded: false, removed: true }, 0),
        );
      const page = await pageWith(browser, {
        css: TOAST_CSS,
        body,
        htmlAttributes: `${c.mode === "force-reduce" ? 'data-reduce-motion="force-reduce"' : ""}${c.who === "account" ? ' data-lax-product="account"' : ""}`,
      });
      try {
        const read = (id: string) =>
          page.evaluate((probe) => {
            const style = getComputedStyle(
              document.querySelector(`[data-probe="${probe}"]`) as Element,
            );
            return {
              duration: style.transitionDuration.split(",")[0]?.trim(),
              properties: style.transitionProperty,
            };
          }, id);
        const shown = await read("shown");
        const leaving = await read("leaving");
        expect(shown.duration).toBe(c.enter);
        expect(leaving.duration).toBe(c.exit);
        expect(shown.properties).toBe(c.properties);
      } finally {
        await page.close();
      }
    }, 30_000);
  }

  for (const [label, rise, options] of [
    ["no preference", "8px", { reducedMotion: "no-preference", html: "" }],
    ["OS reduce", "0px", { reducedMotion: "reduce", html: "" }],
    [
      "force-reduce",
      "0px",
      { reducedMotion: "no-preference", html: 'data-reduce-motion="force-reduce"' },
    ],
    [
      "force-allow over OS reduce",
      "8px",
      { reducedMotion: "reduce", html: 'data-reduce-motion="force-allow"' },
    ],
  ] as const) {
    it(`a new toast starts ${rise} away with ${label}`, async () => {
      const page = await pageWith(browser, {
        css: `${TOAST_CSS}\n*{transition:none!important}`,
        body: toaster(
          toast("fresh", { front: true, expanded: false }, 0).replace(
            'data-mounted="true"',
            'data-mounted="false"',
          ),
        ),
        htmlAttributes: options.html,
        reducedMotion: options.reducedMotion,
      });
      try {
        const [transform] = await page.evaluate(() => [
          getComputedStyle(document.querySelector('[data-probe="fresh"]') as Element).transform,
        ]);
        expect(transform).toBe(
          rise === "8px" ? "matrix(1, 0, 0, 1, 0, 8)" : "matrix(1, 0, 0, 1, 0, 0)",
        );
      } finally {
        await page.close();
      }
    });
  }

  it("under the OS setting Sonner's own rule keeps toasts instant", async () => {
    const page = await pageWith(browser, {
      css: TOAST_CSS,
      body: toaster(toast("shown", { front: true, expanded: false }, 0)),
      reducedMotion: "reduce",
    });
    try {
      const duration = await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('[data-probe="shown"]') as Element)
            .transitionDuration,
      );
      expect(duration).toBe("0s");
    } finally {
      await page.close();
    }
  });
});

describe("tab content resolved in Chromium (docs/design/motion.md, MO13)", () => {
  const cases: { who: Who; mode: Mode; name: string; duration: number }[] = [
    { who: "staff", mode: "none", name: "lax-fade-in", duration: 150 },
    { who: "public", mode: "none", name: "lax-fade-in", duration: 200 },
    { who: "staff", mode: "os-reduce", name: "none", duration: 0 },
    { who: "account", mode: "os-reduce", name: "none", duration: 0 },
    { who: "public", mode: "os-reduce", name: "lax-fade-in", duration: 120 },
    // Bid's own setting, as for the overlays: force-reduce makes staff and Account instant and
    // public a short fade; force-allow wins over the OS setting.
    { who: "staff", mode: "force-reduce", name: "none", duration: 0 },
    { who: "staff-lax-ui", mode: "force-reduce", name: "none", duration: 0 },
    { who: "account", mode: "force-reduce", name: "none", duration: 0 },
    { who: "public", mode: "force-reduce", name: "lax-fade-in", duration: 120 },
    { who: "staff", mode: "force-allow-os-reduce", name: "lax-fade-in", duration: 150 },
    { who: "account", mode: "force-allow-os-reduce", name: "lax-fade-in", duration: 200 },
    { who: "public", mode: "force-allow-os-reduce", name: "lax-fade-in", duration: 200 },
  ];
  for (const c of cases) {
    it(`${c.who}, motion preference ${c.mode}: the active panel runs ${c.name} ${c.duration}ms`, async () => {
      const page = await pageWith(browser, {
        css: CSS,
        body: `${shell(c.who)}<div data-probe="active" data-lax-motion="tabpanel" data-state="active"></div><div data-probe="idle" data-lax-motion="tabpanel" data-state="inactive"></div>`,
        htmlAttributes: htmlAttributes(c.who, c.mode),
        reducedMotion:
          c.mode === "os-reduce" || c.mode === "force-allow-os-reduce" ? "reduce" : "no-preference",
      });
      try {
        const active = await resolveAnimation(page, "active");
        expect({ name: active.name, duration: active.duration }).toEqual({
          name: c.name,
          duration: c.duration,
        });
        // Only opacity: a tab panel never lifts, scales or slides.
        expect(active.moves).toBe(false);
        expect((await resolveAnimation(page, "idle")).name).toBe("none");
      } finally {
        await page.close();
      }
    }, 30_000);
  }
});
