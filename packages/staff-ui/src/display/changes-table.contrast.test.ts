import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs from the package root. Every colour the table uses is a staff token that resolves
// through theme.css into the LAX system layer, so the test reads the values the browser reads.
const css = readFileSync(join(process.cwd(), "src/theme.css"), "utf8");
const laxCss = readFileSync(join(process.cwd(), "../branding/public/lax-system.css"), "utf8");
const laxRoot = laxCss.slice(laxCss.indexOf(":root {"), laxCss.indexOf("\n}\n"));

type Rgba = { r: number; g: number; b: number; a: number };

function declared(source: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(source)?.[1]?.replace(/\s+/g, " ").trim();
}

function resolve(name: string): string {
  let value = declared(css, `color-staff-${name}`);
  for (let hops = 0; value && hops < 5; hops++) {
    const ref = /^var\(--([\w-]+)\)$/.exec(value);
    if (!ref?.[1]) break;
    value = declared(laxRoot, ref[1]) ?? declared(css, ref[1]);
  }
  if (!value) throw new Error(`--color-staff-${name} does not resolve`);
  return value;
}

function parseColour(text: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const fn = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(text);
  if (fn) return { r: +fn[1]!, g: +fn[2]!, b: +fn[3]!, a: fn[4] ? +fn[4] : 1 };
  throw new Error(`cannot read colour ${text}`);
}

/** A token's colour in one scheme, from its `light-dark(a, b)` pair (or a single colour). */
function colour(name: string, scheme: "light" | "dark"): Rgba {
  const value = resolve(name);
  const pair = /^light-dark\((.+?),\s*(#[0-9a-f]{6}|rgb\([^)]*\))\)$/i.exec(value);
  if (!pair) return parseColour(value);
  return parseColour(((scheme === "light" ? pair[1] : pair[2]) ?? "").trim());
}

/** A translucent colour laid over an opaque one, as the browser paints it. */
function over(top: Rgba, base: Rgba): Rgba {
  const mix = (t: number, b: number) => Math.round(t * top.a + b * (1 - top.a));
  return { r: mix(top.r, base.r), g: mix(top.g, base.g), b: mix(top.b, base.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

// Every text-on-background pair the table draws (WCAG 1.4.3, normal text: 4.5:1). A changed row
// paints its tint over the surface the table sits on; cards sit on the surface, and a table in a
// dialog or menu sits on the raised layer, so both are checked.
const surfaces = ["surface", "raised"] as const;
const pairs: { name: string; text: string; onTint: boolean | "sunken" }[] = [
  { name: "changed row label and struck-through before value", text: "warning-fg", onTint: true },
  { name: "after value in a changed row", text: "fg", onTint: true },
  { name: "unchanged before and after value", text: "fg", onTint: false },
  { name: "unchanged row label", text: "muted", onTint: false },
  { name: "column headings", text: "muted", onTint: "sunken" },
];

describe("ChangesTable colour contrast", () => {
  for (const scheme of ["light", "dark"] as const) {
    describe(scheme, () => {
      for (const surface of surfaces) {
        for (const pair of pairs) {
          it(`${pair.name} on ${surface} is at least 4.5:1`, () => {
            const base = colour(surface, scheme);
            const background =
              pair.onTint === "sunken"
                ? colour("sunken", scheme)
                : pair.onTint
                  ? over(colour("warning-bg", scheme), base)
                  : base;
            const ratio = contrast(colour(pair.text, scheme), background);
            expect(ratio).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
    });
  }
});
