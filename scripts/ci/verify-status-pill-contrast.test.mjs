// Status pill contrast in every product that renders the shared pill (lax.art, LAX Shop,
// LAX Account, LAX Bid), light and dark, read from the stylesheets that ship. Labels must reach
// 4.5:1 on their tint and glyphs 3:1 on their circle (WCAG 1.4.3, 1.4.11).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SCHEME = Symbol("scheme");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");

function declarations(css, selector) {
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
  const map = new Map();
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1], m[2].replace(/\s+/g, " ").trim());
  }
  return map;
}

const primitives = new Map([
  ...declarations(read("packages/branding/public/brand-primitives.css"), /:root\s*\{/),
  ...declarations(read("packages/branding/public/lax-system.css"), /:root\s*\{/),
]);

/**
 * Light tokens from `@theme`, dark from `html.dark` over light. Each map knows its scheme, so a
 * `light-dark()` pair resolves to its half.
 */
function product(lightFile, darkFile = lightFile) {
  const light = new Map([...primitives, ...declarations(read(lightFile), /@theme\s*\{/)]);
  const dark = new Map([...light, ...declarations(read(darkFile), /html\.dark\s*\{/)]);
  light.set(SCHEME, "light");
  dark.set(SCHEME, "dark");
  return { light, dark };
}

/** `a, b` split on the top-level comma only. */
function splitPair(inner) {
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    if (inner[i] === ")") depth--;
    if (inner[i] === "," && depth === 0) return [inner.slice(0, i), inner.slice(i + 1)];
  }
  throw new Error(`not a light-dark pair: ${inner}`);
}

const PRODUCTS = {
  "lax.art": product("apps/art/src/app/base.css"),
  "LAX Shop": product("apps/shop/src/app/base.css"),
  "LAX Account": product("apps/account/src/app/globals.css"),
  "LAX Bid": product("apps/web/src/app/globals.css", "apps/web/src/styles/tokens-dark.css"),
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklch(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1),
    clamp(-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1),
    clamp(-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1),
  ];
}

function resolve(value, tokens, depth = 0) {
  if (depth > 20) throw new Error(`token loop at ${value}`);
  const v = value.trim();
  const ref = v.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/);
  if (ref) {
    const next = tokens.get(ref[1]) ?? ref[2];
    if (!next) throw new Error(`unknown token ${ref[1]}`);
    return resolve(next, tokens, depth + 1);
  }
  const pair = v.match(/^light-dark\((.+)\)$/);
  if (pair) {
    const [light, dark] = splitPair(pair[1]);
    return resolve(tokens.get(SCHEME) === "dark" ? dark : light, tokens, depth + 1);
  }
  // A translucent tint is painted over the product's surface.
  const rgba = v.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);
  if (rgba) {
    const alpha = Number(rgba[4]);
    const backdrop = resolve("var(--color-surface)", tokens, depth + 1).map(toSrgb);
    return [1, 2, 3].map((i) =>
      toLinear((Number(rgba[i]) / 255) * alpha + backdrop[i - 1] * (1 - alpha)),
    );
  }
  if (v.startsWith("#")) {
    let h = v.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const n = Number.parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => toLinear(x / 255));
  }
  if (v === "white") return [1, 1, 1];
  const ok = v.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/);
  if (ok) return oklch(Number(ok[1]), Number(ok[2]), Number(ok[3]));
  const mix = v.match(/^color-mix\(\s*in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+?)\s*\)$/);
  if (mix) {
    const a = resolve(mix[1], tokens, depth + 1).map(toSrgb);
    const b = resolve(mix[3], tokens, depth + 1).map(toSrgb);
    const p = Number(mix[2]) / 100;
    return a.map((x, i) => toLinear(x * p + b[i] * (1 - p)));
  }
  throw new Error(`cannot resolve colour ${v}`);
}

function contrast(fg, bg, tokens) {
  const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const [hi, lo] = [
    lum(resolve(`var(--color-${fg})`, tokens)),
    lum(resolve(`var(--color-${bg})`, tokens)),
  ].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Label token on tint token, and the glyph circle, for the tones that use the `*-on-surface` inks. */
const TONES = [
  { name: "info", label: "info-on-surface", fill: "info-container", circle: "info-on-surface" },
  {
    name: "warning",
    label: "warning-on-surface",
    fill: "warning-container",
    circle: "warning-on-surface",
  },
  { name: "danger", label: "danger-on-surface", fill: "danger-container", circle: null },
];

describe("status pill contrast", () => {
  for (const [productName, themes] of Object.entries(PRODUCTS)) {
    for (const theme of ["light", "dark"]) {
      for (const tone of TONES) {
        it(`${productName} ${theme}: ${tone.name} label reads at 4.5:1 on its tint`, () => {
          const ratio = contrast(tone.label, tone.fill, themes[theme]);
          assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`);
        });
        if (tone.circle) {
          it(`${productName} ${theme}: ${tone.name} glyph reads at 3:1 on its circle`, () => {
            const ratio = contrast("on-primary", tone.circle, themes[theme]);
            assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1`);
          });
        }
      }
    }
  }
});
