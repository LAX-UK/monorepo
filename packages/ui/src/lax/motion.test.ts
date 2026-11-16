import { describe, expect, it } from "vitest";
import { MOTION_CSS, stripComments } from "../test/motion-css.js";

const css = stripComments(MOTION_CSS);

/** The declaration blocks of every `@keyframes name { ... }`, by name. */
function keyframes(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of source.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    map.set(m[1] as string, m[2] as string);
  }
  return map;
}

describe("overlay motion stylesheet", () => {
  it("defines the small set of keyframes the kit uses", () => {
    expect([...keyframes(css).keys()].sort()).toEqual([
      "lax-fade-in",
      "lax-fade-out",
      "lax-float-in",
      "lax-float-out",
      "lax-rise-in",
      "lax-rise-out",
      "lax-slide-in",
      "lax-slide-out",
    ]);
  });

  it("animates transform and opacity only", () => {
    for (const [name, body] of keyframes(css)) {
      const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
      for (const property of properties) {
        expect(["opacity", "transform"], `${name} animates ${property}`).toContain(property);
      }
    }
  });

  it("takes every duration and easing from the tokens", () => {
    const withoutKeyframes = css.replace(/@keyframes [\w-]+ \{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
    expect(withoutKeyframes).not.toMatch(/\b\d+(?:\.\d+)?m?s\b/);
    expect(withoutKeyframes).not.toMatch(/cubic-bezier|ease-in-out|(?<![-\w])ease(?![-\w])/);
    expect(css).not.toMatch(/transition:\s*all|will-change/);
  });

  it("scales from 0.97 and moves 4px for floating layers, 8px and 0.98 for dialogs", () => {
    const k = keyframes(css);
    expect(k.get("lax-float-in")).toContain("scale(0.97)");
    expect(k.get("lax-rise-in")).toContain("translateY(8px) scale(0.98)");
    expect(css).toMatch(/\[data-side="bottom"\] \{\s*--lax-from-y: -4px/);
    expect(css).toMatch(/\[data-side="top"\] \{\s*--lax-from-y: 4px/);
  });

  it("times each kind with its tokens", () => {
    const rule = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      expect(start, `${selector} rule`).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf("}", start));
    };
    const float = rule('[data-lax-motion="float"]');
    expect(float).toContain("lax-float-in var(--lax-motion-enter) var(--lax-ease-out)");
    expect(float).toContain("lax-float-out var(--lax-motion-exit) var(--lax-ease-in)");
    const dialog = rule('[data-lax-motion="dialog"]');
    expect(dialog).toContain("lax-rise-in var(--lax-motion-panel) var(--lax-ease-emphasize)");
    expect(dialog).toContain("lax-rise-out var(--lax-motion-panel-exit)");
    const sheet = rule('[data-lax-motion="sheet"]');
    expect(sheet).toContain("lax-slide-in var(--lax-motion-panel) var(--lax-ease-emphasize)");
    expect(sheet).toContain("lax-slide-out var(--lax-motion-panel-exit)");
    expect(rule('[data-lax-motion="tip"]')).toContain("var(--lax-motion-fade)");
  });

  it("makes layers on a staff page fade only, with no movement keyframe", () => {
    const staff = css.match(
      /:root:has\(\[data-lax-density="staff"\]\) \[data-lax-motion="float"\] \{[^}]*\}/,
    );
    expect(staff?.[0]).toContain("lax-fade-in");
    expect(staff?.[0].split("{")[1]).not.toMatch(/float|rise|slide/);
    const panels = css.match(/:root:has\(\[data-lax-density="staff"\]\) :is\([^)]*\) \{[^}]*\}/);
    expect(panels?.[0]).toContain("lax-fade-in var(--lax-motion-panel)");
  });

  it("does not animate a tooltip that opens straight after another", () => {
    expect(css).toContain('[data-state="delayed-open"]');
    expect(css).not.toContain("instant-open");
  });

  it("moves toasts 8px with Sonner's variables, on the tokens", () => {
    expect(css).toContain("--lax-toast-rise: 8px");
    expect(css).toContain("--y: translateY(calc(var(--lift) * var(--lax-toast-rise) * -1))");
    expect(css).toContain("transform var(--lax-motion-enter) var(--lax-ease-out)");
    expect(css).toContain("transform var(--lax-motion-exit) var(--lax-ease-in)");
    expect(css).toMatch(
      /:root:has\(\[data-lax-density="staff"\]\) \[data-sonner-toaster\] \{\s*--lax-toast-rise: 0px/,
    );
  });
});

// Reduced motion, staff timings and the toast rules are checked on what Chromium resolves, in
// motion-resolved.test.ts, not on the stylesheet's text.
