import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOAST_SUCCESS_COLOURS } from "@auction/ui";
import { describe, expect, it } from "vitest";

/**
 * The success toast (the Undo toast after a role change, and every other confirmation) reads its
 * colours from the Bid theme's success tokens. Its text must reach 4.5:1 on its background in
 * light and dark.
 */
const SRC = join(__dirname, "..", "..");
const THEMES = {
  light: readFileSync(join(SRC, "app", "globals.css"), "utf8"),
  dark: readFileSync(join(SRC, "styles", "tokens-dark.css"), "utf8"),
};

function token(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`${name} not defined`);
  return match[1].trim();
}

/** The variable a toast colour points at: "var(--color-success-container)". */
function referenced(value: string | undefined): string {
  const match = value?.match(/^var\((--[\w-]+)\)$/);
  if (!match?.[1]) throw new Error(`not a token reference: ${value}`);
  return match[1];
}

/** Linear sRGB channels for a #rrggbb or oklch(L C h) colour. */
function linearRgb(colour: string): [number, number, number] {
  const hex = colour.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) {
    return [0, 2, 4].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
  }
  const ok = colour.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!ok) throw new Error(`unsupported colour ${colour}`);
  const [L, C, h] = [Number(ok[1]), Number(ok[2]), (Number(ok[3]) * Math.PI) / 180];
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function contrast(fg: string, bg: string): number {
  const lum = (c: string) => {
    const [r, g, b] = linearRgb(c);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("success toast colours", () => {
  const text = referenced(TOAST_SUCCESS_COLOURS["--success-text"]);
  const background = referenced(TOAST_SUCCESS_COLOURS["--success-bg"]);

  it.each(Object.entries(THEMES))("give its text 4.5:1 or more in %s", (_theme, css) => {
    expect(contrast(token(css, text), token(css, background))).toBeGreaterThanOrEqual(4.5);
  });
});
