import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reads Bid's colour tokens from the real stylesheets, so contrast tests check what ships.
 * Light values come from the `@theme` block in globals.css; dark values from `html.dark` in
 * tokens-dark.css, falling back to light for tokens dark mode does not override.
 */

type Rgb = readonly [number, number, number];
type TokenMap = Map<string, string>;

const SRC_DIR = path.resolve(__dirname, "..");

function readDeclarations(css: string, selector: RegExp): TokenMap {
  const map: TokenMap = new Map();
  const start = css.search(selector);
  if (start < 0) throw new Error(`no block matching ${selector}`);
  let depth = 0;
  let body = "";
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    body += ch;
    if (depth === 0) break;
  }
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1] as string, (m[2] as string).replace(/\s+/g, " ").trim());
  }
  return map;
}

function loadThemes(): { light: TokenMap; dark: TokenMap } {
  const globals = readFileSync(path.join(SRC_DIR, "app/globals.css"), "utf8");
  const darkCss = readFileSync(path.join(SRC_DIR, "styles/tokens-dark.css"), "utf8");
  const light = readDeclarations(globals, /@theme\s*\{/);
  const dark = new Map([...light, ...readDeclarations(darkCss, /html\.dark\s*\{/)]);
  return { light, dark };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Linear sRGB, clamped to the gamut the way browsers clip oklch. */
function oklchToLinear(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1),
    clamp(-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1),
    clamp(-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1),
  ];
}

function hexToLinear(hex: string): Rgb {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

function resolve(value: string, tokens: TokenMap, depth = 0): Rgb {
  if (depth > 20) throw new Error(`token loop at ${value}`);
  const v = value.trim();
  const ref = v.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/);
  if (ref) {
    const next = tokens.get(ref[1] as string) ?? ref[2];
    if (!next) throw new Error(`unknown token ${ref[1]}`);
    return resolve(next, tokens, depth + 1);
  }
  if (v.startsWith("#")) return hexToLinear(v);
  if (v === "white") return [1, 1, 1];
  if (v === "black") return [0, 0, 0];
  const ok = v.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/);
  if (ok) return oklchToLinear(Number(ok[1]), Number(ok[2]), Number(ok[3]));
  const mix = v.match(/^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/);
  if (mix) {
    // color-mix in srgb interpolates gamma-encoded channels.
    const a = resolve(mix[1] as string, tokens, depth + 1).map(linearToSrgb);
    const b = resolve(mix[3] as string, tokens, depth + 1).map(linearToSrgb);
    const p = Number(mix[2]) / 100;
    return a.map((x, i) => srgbToLinear(x * p + (b[i] as number) * (1 - p))) as unknown as Rgb;
  }
  throw new Error(`cannot resolve colour ${v}`);
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type Theme = "light" | "dark";

/** WCAG contrast ratio between two Bid tokens (names without `--color-`), in one theme. */
export function createTokenContrast() {
  const themes = loadThemes();
  return function contrast(fg: string, bg: string, theme: Theme): number {
    const tokens = themes[theme];
    const read = (name: string) => {
      const raw = tokens.get(`--color-${name}`);
      if (!raw) throw new Error(`--color-${name} is not defined for ${theme}`);
      return resolve(raw, tokens);
    };
    const a = luminance(read(fg));
    const b = luminance(read(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
}
