import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STAFF_CONTROL_BORDER_MIN_CONTRAST,
  STAFF_CONTROL_HEIGHT,
  STAFF_LAYOUT,
  STAFF_RADIUS,
  STAFF_STATUS_TONES,
  STAFF_STICKY_LAYERS,
  STAFF_TYPE_SCALE,
} from "./tokens.js";

// Vitest runs from the package root. The theme names the LAX system tokens for Tailwind; the
// values live in @auction/branding's lax-system.css, so every lookup resolves through it.
const css = readFileSync(join(process.cwd(), "src/theme.css"), "utf8");
const laxCss = readFileSync(join(process.cwd(), "../branding/public/lax-system.css"), "utf8");
const laxRoot = laxCss.slice(laxCss.indexOf(":root {"), laxCss.indexOf("\n}\n"));

function declared(source: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(source)?.[1]?.replace(/\s+/g, " ").trim();
}

/** A theme token's value, following `var(--lax-*)` into the shared layer. */
function token(name: string): string | undefined {
  let value = declared(css, name);
  for (let hops = 0; value && hops < 5; hops++) {
    const ref = /^var\(--(lax-[\w-]+)\)$/.exec(value);
    if (!ref?.[1]) break;
    value = declared(laxRoot, ref[1]);
  }
  return value;
}

/** The light and dark hex values of a `light-dark(#xxxxxx, #xxxxxx)` colour token. */
function pair(name: string): { light: string; dark: string } {
  const match = /^light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)$/i.exec(token(name) ?? "");
  if (!match?.[1] || !match[2]) throw new Error(`--${name} is not a light-dark hex pair`);
  return { light: match[1], dark: match[2] };
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** theme.css is what the browser reads; tokens.ts documents it. They must not drift. */
describe("staff tokens", () => {
  it.each(Object.entries(STAFF_TYPE_SCALE))("type step %s matches the theme", (step, spec) => {
    expect(token(`text-staff-${step}`)).toBe(`${spec.size}px`);
    expect(token(`text-staff-${step}--line-height`)).toBe(`${spec.lineHeight}px`);
  });

  it.each(Object.entries(STAFF_RADIUS))("radius %s matches the theme", (step, spec) => {
    expect(token(`radius-staff-${step}`)).toBe(`${spec.px}px`);
  });

  it.each(Object.entries(STAFF_CONTROL_HEIGHT))("control height %s matches", (step, spec) => {
    expect(token(`spacing-control-${step}`)).toBe(`${spec.px}px`);
  });

  it.each(Object.entries(STAFF_STICKY_LAYERS))("sticky layer %s matches", (name, px) => {
    expect(token(`spacing-staff-${name}`)).toBe(`${px}px`);
  });

  it("documents the same top bar height the shell reserves", () => {
    expect(STAFF_STICKY_LAYERS["top-bar"]).toBe(STAFF_LAYOUT.topBarHeight);
  });

  it("keeps every line height on the 4px grid", () => {
    for (const spec of Object.values(STAFF_TYPE_SCALE)) {
      expect(spec.lineHeight % 4).toBe(0);
    }
  });

  it("declares every colour as a light and dark pair", () => {
    const colours = [...css.matchAll(/--color-staff-([\w-]+):/g)].map((m) => m[1] ?? "");
    expect(colours.length).toBeGreaterThan(30);
    for (const name of colours) expect(token(`color-staff-${name}`)).toMatch(/^light-dark\(/);
  });

  it("reads every shared value from the LAX system layer", () => {
    const refs = [...css.matchAll(/var\(--(lax-[\w-]+)\)/g)].map((m) => m[1] ?? "");
    expect(refs.length).toBeGreaterThan(60);
    for (const ref of refs) expect(declared(laxRoot, ref), ref).toBeDefined();
  });

  it("keeps no colour of its own except Bid's accent", () => {
    const raw = [...css.matchAll(/(--color-staff-[\w-]+):\s*(light-dark\([^;]+|#[0-9a-f]+)/gi)];
    expect(raw.map((m) => m[1])).toEqual(["--color-staff-accent"]);
  });

  describe("form-control boundaries keep 3:1 against every surface (WCAG 1.4.11)", () => {
    const surfaces = ["canvas", "surface", "sunken", "raised"];
    it.each(
      ["control-border", "control-border-hover"].flatMap((border) =>
        surfaces.flatMap((surface) =>
          (["light", "dark"] as const).map((scheme) => [border, surface, scheme] as const),
        ),
      ),
    )("%s on %s (%s)", (border, surface, scheme) => {
      const ratio = contrast(
        pair(`color-staff-${border}`)[scheme],
        pair(`color-staff-${surface}`)[scheme],
      );
      expect(ratio).toBeGreaterThanOrEqual(STAFF_CONTROL_BORDER_MIN_CONTRAST);
    });

    it.each(["light", "dark"] as const)("the switch thumb on its off track (%s)", (scheme) => {
      const ratio = contrast(
        pair("color-staff-thumb")[scheme],
        pair("color-staff-control-border")[scheme],
      );
      expect(ratio).toBeGreaterThanOrEqual(STAFF_CONTROL_BORDER_MIN_CONTRAST);
    });
  });

  describe("status badge text keeps 4.5:1 on its fill", () => {
    const pairs = [
      ...STAFF_STATUS_TONES.filter((tone) => tone !== "live").map(
        (tone) => [tone, `color-staff-${tone}-fg`, `color-staff-${tone}-bg`] as const,
      ),
      ["live", "color-staff-on-live", "color-staff-live-bg"] as const,
    ];
    it.each(
      pairs.flatMap(([tone, fg, bg]) =>
        (["light", "dark"] as const).map((scheme) => [tone, scheme, fg, bg] as const),
      ),
    )("%s (%s)", (_tone, scheme, fg, bg) => {
      // Tinted dark fills are translucent rgb(); only opaque hex fills are measured here.
      const parts = /^light-dark\(([^,]+),\s*(.+)\)$/.exec(token(bg) ?? "");
      const background = (scheme === "light" ? parts?.[1] : parts?.[2])?.trim() ?? "";
      if (!background.startsWith("#")) return;
      expect(contrast(pair(fg)[scheme], background)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("reserves the sticky layers' height around the focused element", () => {
    expect(css).toMatch(/:root:has\(\[data-staff-shell\]\)\s*\{\s*scroll-padding-top/);
    expect(css).toMatch(/:root:has\(\[data-staff-bulk-bar\]\)\s*\{\s*scroll-padding-bottom/);
  });
});
