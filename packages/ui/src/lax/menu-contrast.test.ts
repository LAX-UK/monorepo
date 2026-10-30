import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A destructive menu item reads at 4.5:1 at rest and when highlighted, in light and dark, on the
 * menu surface. The highlight is a translucent tint, so it is laid over the menu surface first.
 */
const laxCss = readFileSync(join(process.cwd(), "../branding/public/lax-system.css"), "utf8");
const menuSource = readFileSync(join(process.cwd(), "src/lax/menu.tsx"), "utf8");
/** The class list the menu gives a danger item: the one that sets its tinted highlight. */
const dangerClasses =
  menuSource.split("\n").find((line) => line.includes("bg-lax-danger-bg")) ?? "";

type Rgb = [number, number, number];
type Colour = { rgb: Rgb; alpha: number };

function token(name: string): { light: string; dark: string } {
  const match = new RegExp(`--${name}:\\s*light-dark\\(([^;]+)\\);`).exec(laxCss);
  const body = match?.[1];
  if (!body) throw new Error(`--${name} is not a light-dark value`);
  const split = body.match(/(rgb\([^)]*\)|#[0-9a-f]{6})/gi);
  if (!split || split.length !== 2) throw new Error(`--${name} is not a light/dark pair`);
  return { light: split[0] as string, dark: split[1] as string };
}

function parse(value: string): Colour {
  if (value.startsWith("#")) {
    return {
      rgb: [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as Rgb,
      alpha: 1,
    };
  }
  const parts = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)/.exec(value);
  if (!parts) throw new Error(`Cannot read ${value}`);
  return {
    rgb: [Number(parts[1]), Number(parts[2]), Number(parts[3])],
    alpha: parts[4] ? Number(parts[4]) : 1,
  };
}

function over(top: Colour, base: Rgb): Rgb {
  return top.rgb.map((c, i) => c * top.alpha + (base[i] ?? 0) * (1 - top.alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour class the menu gives a danger item in a state, e.g. `data-[highlighted]:text-…`. */
function textTokenFor(prefix: string): string {
  const match = new RegExp(`${prefix.replace(/[[\]]/g, "\\$&")}text-(lax-[\\w-]+)`).exec(
    dangerClasses,
  );
  if (!match?.[1]) throw new Error(`No ${prefix}text- class on the danger item`);
  return match[1];
}

describe("danger menu item contrast", () => {
  const surface = token("lax-raised");
  const highlight = token("lax-danger-bg");
  it.each(["light", "dark"] as const)("keeps 4.5:1 at rest and highlighted (%s)", (scheme) => {
    const base = parse(surface[scheme]).rgb;
    const rest = parse(token(textTokenFor('"'))[scheme]).rgb;
    expect(contrast(rest, base)).toBeGreaterThanOrEqual(4.5);
    const tinted = over(parse(highlight[scheme]), base);
    const highlighted = parse(token(textTokenFor("data-[highlighted]:"))[scheme]).rgb;
    expect(contrast(highlighted, tinted)).toBeGreaterThanOrEqual(4.5);
    const focused = parse(token(textTokenFor("focus:"))[scheme]).rgb;
    expect(contrast(focused, tinted)).toBeGreaterThanOrEqual(4.5);
  });
});
