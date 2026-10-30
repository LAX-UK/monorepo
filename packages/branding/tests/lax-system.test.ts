import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAX_CONTROL_HEIGHT,
  LAX_DENSITY,
  LAX_FOCUS_RING,
  LAX_MIN_CONTRAST,
  LAX_RADIUS,
  LAX_STATUS_TONES,
  LAX_SURFACES,
  LAX_TYPE_SCALE,
} from "../src/lax-system.js";

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
const css = read("../public/lax-system.css");
const primitives = read("../public/brand-primitives.css");

type Scheme = "light" | "dark";
type Rgba = readonly [number, number, number, number];

/** Declarations of the first block matching `selector`, comments removed. */
function block(source: string, selector: RegExp): Map<string, string> {
  const start = source.search(selector);
  if (start < 0) throw new Error(`no block matching ${selector}`);
  const open = source.indexOf("{", start);
  const body = source.slice(open + 1, source.indexOf("}", open)).replace(/\/\*[\s\S]*?\*\//g, "");
  const map = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1] as string, (m[2] as string).replace(/\s+/g, " ").trim());
  }
  return map;
}

const root = block(css, /:root\s*\{/);
const tokens = new Map([...block(primitives, /:root\s*\{/), ...root]);

/** `a, b` split on the top-level comma only. */
function splitPair(inner: string): [string, string] {
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    if (inner[i] === ")") depth--;
    if (inner[i] === "," && depth === 0) return [inner.slice(0, i), inner.slice(i + 1)];
  }
  throw new Error(`not a pair: ${inner}`);
}

/** A colour token as straight sRGB 0-1 with alpha, in one scheme. */
function colour(value: string, scheme: Scheme, depth = 0): Rgba {
  if (depth > 10) throw new Error(`token loop at ${value}`);
  const v = value.trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) {
    const next = tokens.get(ref[1] as string);
    if (!next) throw new Error(`unknown token ${ref[1]}`);
    return colour(next, scheme, depth + 1);
  }
  const ld = /^light-dark\((.+)\)$/.exec(v);
  if (ld) {
    const [light, dark] = splitPair(ld[1] as string);
    return colour(scheme === "light" ? light : dark, scheme, depth + 1);
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = Number.parseInt(hex[1] as string, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(v);
  if (rgb) {
    const [r, g, b, a] = rgb.slice(1).map(Number) as [number, number, number, number];
    return [r / 255, g / 255, b / 255, a];
  }
  throw new Error(`cannot read colour ${v}`);
}

const token = (name: string, scheme: Scheme) => {
  const raw = tokens.get(`--lax-${name}`);
  if (!raw) throw new Error(`--lax-${name} is not defined`);
  return colour(raw, scheme);
};

/** A translucent colour laid over an opaque one, as browsers paint it. */
function over([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

const SCHEMES = ["light", "dark"] as const;
const SURFACES = [...LAX_SURFACES, "paper"] as const;
const each = <T extends string>(names: readonly T[]) =>
  names.flatMap((name) => SCHEMES.map((scheme) => [name, scheme] as const));

describe("the LAX system scales match their documentation", () => {
  it.each(Object.entries(LAX_RADIUS))("radius %s", (role, spec) => {
    expect(root.get(`--lax-radius-${role}`)).toBe(`${spec.px}px`);
  });

  it.each(Object.entries(LAX_CONTROL_HEIGHT))("control height %s", (step, spec) => {
    expect(root.get(`--lax-control-${step}`)).toBe(`${spec.px}px`);
  });

  it.each(Object.entries(LAX_TYPE_SCALE))("type %spx", (size, spec) => {
    expect(root.get(`--lax-text-${size}`)).toBe(`${size}px`);
    expect(root.get(`--lax-text-${size}--line`)).toBe(`${spec.lineHeight}px`);
    if ("paragraph" in spec) {
      expect(root.get(`--lax-text-${size}--paragraph`)).toBe(`${spec.paragraph}px`);
    }
  });

  it("keeps every line height on the 4px grid", () => {
    const heights = [...root].filter(([name]) => /^--lax-text-\d+--/.test(name));
    expect(heights.length).toBeGreaterThan(8);
    for (const [, value] of heights) expect(Number.parseInt(value, 10) % 4).toBe(0);
  });

  it("draws the focus ring at the documented width and offset", () => {
    expect(root.get("--lax-focus-width")).toBe(`${LAX_FOCUS_RING.width}px`);
    expect(root.get("--lax-focus-offset")).toBe(`${LAX_FOCUS_RING.offset}px`);
  });

  it.each(Object.entries(LAX_DENSITY))("the %s density layer", (density, spec) => {
    const layer = block(css, new RegExp(`\\[data-lax-density="${density}"\\]\\s*\\{`));
    const px = (name: string) => {
      const value = layer.get(`--lax-density-${name}`) ?? "";
      const ref = /^var\((--[\w-]+)\)$/.exec(value);
      return ref ? root.get(ref[1] as string) : value;
    };
    expect(px("text")).toBe(`${spec.text}px`);
    expect(px("text-line")).toBe(`${spec.lineHeight}px`);
    expect(px("control")).toBe(`${spec.control}px`);
    expect(px("row")).toBe(`${spec.row}px`);
  });

  it("grows client controls to the touch height on phones and touch screens", () => {
    expect(css).toMatch(
      /@media \(max-width: 47\.99rem\), \(pointer: coarse\) \{\s*\[data-lax-density="client"\] \{\s*--lax-density-control: var\(--lax-control-lg\);/,
    );
    expect(LAX_DENSITY.client.controlOnTouch).toBe(LAX_CONTROL_HEIGHT.lg.px);
  });
});

describe("every colour is one light and dark pair, declared once", () => {
  const colours = [...root].filter(
    ([name]) => !/radius|control-(sm|md|lg)|text|shadow|focus-(width|offset)/.test(name),
  );

  it("declares each colour as light-dark() or as an alias of another LAX token", () => {
    expect(colours.length).toBeGreaterThan(40);
    for (const [name, value] of colours) {
      expect(value, name).toMatch(/^(light-dark\(|var\(--(lax|brand)-)/);
    }
  });

  it("has no two tokens with the same light and dark values (alias one instead)", () => {
    const seen = new Map<string, string>();
    for (const [name, value] of colours) {
      if (!value.startsWith("light-dark(")) continue;
      expect(seen.get(value), `${name} repeats ${seen.get(value)}`).toBeUndefined();
      seen.set(value, name);
    }
  });

  it("resolves every alias", () => {
    for (const [name, value] of root) {
      for (const ref of value.matchAll(/var\((--[\w-]+)\)/g)) {
        expect(tokens.has(ref[1] as string), `${name} reads ${ref[1]}`).toBe(true);
      }
    }
  });
});

describe("contrast in light and dark", () => {
  it.each(each(SURFACES))("text and muted text read at 4.5:1 on %s (%s)", (surface, scheme) => {
    for (const text of ["fg", "muted", "subtle"]) {
      expect(contrast(token(text, scheme), token(surface, scheme))).toBeGreaterThanOrEqual(
        LAX_MIN_CONTRAST.text,
      );
    }
  });

  it.each(each(SURFACES))("the control edge keeps 3:1 on %s (%s)", (surface, scheme) => {
    for (const edge of ["control-edge", "control-edge-hover"]) {
      expect(contrast(token(edge, scheme), token(surface, scheme))).toBeGreaterThanOrEqual(
        LAX_MIN_CONTRAST.nonText,
      );
    }
  });

  it.each(SCHEMES)("the switch thumb keeps 3:1 on its off track (%s)", (scheme) => {
    expect(contrast(token("thumb", scheme), token("control-edge", scheme))).toBeGreaterThanOrEqual(
      LAX_MIN_CONTRAST.nonText,
    );
  });

  it.each(each(SURFACES))("the focus ring keeps 3:1 on %s (%s)", (surface, scheme) => {
    expect(contrast(token("focus", scheme), token(surface, scheme))).toBeGreaterThanOrEqual(
      LAX_MIN_CONTRAST.nonText,
    );
  });

  describe("disabled", () => {
    it.each(each([...SURFACES, "disabled-bg", "line"]))(
      "the label reads at 3:1 on %s (%s)",
      (surface, scheme) => {
        expect(
          contrast(token("disabled-fg", scheme), token(surface, scheme)),
        ).toBeGreaterThanOrEqual(LAX_MIN_CONTRAST.nonText);
      },
    );

    it.each(SCHEMES)("the label is clearly lighter than an enabled button label (%s)", (scheme) => {
      for (const label of ["fg", "muted"]) {
        expect(contrast(token(label, scheme), token("disabled-fg", scheme))).toBeGreaterThanOrEqual(
          1.4,
        );
      }
    });

    it.each(SCHEMES)("the edge is quieter than an enabled control's (%s)", (scheme) => {
      const surface = token("surface", scheme);
      expect(contrast(token("disabled-border", scheme), surface)).toBeLessThan(
        contrast(token("control-edge", scheme), surface),
      );
    });
  });

  describe("filled buttons through hover and pressed", () => {
    const fills = [
      ["primary", "on-ink", ["ink", "ink-hover", "ink-pressed"]],
      ["danger", "on-danger", ["danger-solid", "danger-solid-hover", "danger-solid-pressed"]],
    ] as const;

    it.each(
      fills.flatMap(([name, label, steps]) =>
        SCHEMES.map((scheme) => [name, scheme, label, steps] as const),
      ),
    )("%s keeps its label at 4.5:1 in every state (%s)", (_name, scheme, label, steps) => {
      for (const step of steps) {
        expect(contrast(token(label, scheme), token(step, scheme))).toBeGreaterThanOrEqual(
          LAX_MIN_CONTRAST.text,
        );
      }
    });

    it.each(
      fills.flatMap(([name, , steps]) => SCHEMES.map((scheme) => [name, scheme, steps] as const)),
    )(
      "%s pressed is its own fill, apart from rest and hover (%s)",
      (_name, scheme, [rest, hover, pressed]) => {
        expect(token(pressed, scheme)).not.toBe(token(rest, scheme));
        expect(token(pressed, scheme)).not.toBe(token(hover, scheme));
      },
    );
  });

  describe("status text on its tint, on every surface the tint is laid over", () => {
    const pairs = [
      ...LAX_STATUS_TONES.map((tone) => [tone, `${tone}-fg`, `${tone}-bg`] as const),
      ["live", "on-live", "live-bg"] as const,
      ["danger solid", "on-danger", "danger-solid"] as const,
    ];
    it.each(
      pairs.flatMap(([tone, fg, bg]) =>
        SURFACES.flatMap((surface) =>
          SCHEMES.map((scheme) => [tone, surface, scheme, fg, bg] as const),
        ),
      ),
    )("%s on %s (%s)", (_tone, surface, scheme, fg, bg) => {
      const fill = over(token(bg, scheme), token(surface, scheme));
      expect(contrast(token(fg, scheme), fill)).toBeGreaterThanOrEqual(LAX_MIN_CONTRAST.text);
    });

    it.each(each(SURFACES))("danger as text reads at 4.5:1 on %s (%s)", (surface, scheme) => {
      expect(contrast(token("danger", scheme), token(surface, scheme))).toBeGreaterThanOrEqual(
        LAX_MIN_CONTRAST.text,
      );
    });
  });
});

describe("the brand primitives' status inks are the LAX status palette", () => {
  const brand = block(primitives, /:root\s*\{/);
  it.each(["info", "warning", "danger"] as const)("%s", (tone) => {
    const pair = /^light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/i.exec(
      root.get(`--lax-${tone}-fg`) ?? "",
    );
    expect(brand.get(`--status-${tone}-ink`)).toBe(pair?.[1]);
    expect(brand.get(`--status-${tone}-ink-on-dark`)).toBe(pair?.[2]);
  });
});
