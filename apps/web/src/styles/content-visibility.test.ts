import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf8");

type Rule = {
  selectors: string[];
  declarations: Map<string, string>;
  /** The cascade layer the file is imported into, or null for an unlayered file. */
  layer: string | null;
  media: string | null;
  order: number;
};

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The matching close brace for the open brace at `open`. */
function closing(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("unbalanced braces");
}

function parseDeclarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of body.split(";")) {
    const colon = part.indexOf(":");
    if (colon > 0) map.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
  }
  return map;
}

function parse(css: string, layer: string | null, media: string | null, start: number): Rule[] {
  const rules: Rule[] = [];
  let order = start;
  let rest = stripComments(css);
  while (rest.trim()) {
    const open = rest.indexOf("{");
    if (open < 0) break;
    const header = rest
      .slice(0, open)
      .trim()
      .replace(/^[^{}]*;\s*/, "");
    const close = closing(rest, open);
    const body = rest.slice(open + 1, close);
    if (header.startsWith("@media")) {
      rules.push(...parse(body, layer, header.slice("@media".length).trim(), order));
    } else if (header.startsWith("@layer")) {
      rules.push(...parse(body, header.slice("@layer".length).trim(), media, order));
    } else if (!header.startsWith("@")) {
      rules.push({
        selectors: header.split(",").map((selector) => selector.trim()),
        declarations: parseDeclarations(body),
        layer,
        media,
        order,
      });
    }
    order += 1;
    rest = rest.slice(close + 1);
  }
  return rules;
}

/** Each stylesheet's layer, from the `@import ... layer(x)` that brings it into the app. */
function importedLayer(globals: string, file: string): string | null {
  const match = globals.match(new RegExp(`@import "[^"]*${file}"\\s*(?:layer\\(([^)]+)\\))?;`));
  if (!match) throw new Error(`${file} is not imported by globals.css`);
  return match[1] ?? null;
}

const globals = readFileSync(join(here, "../app/globals.css"), "utf8");
const sheets = ["tokens-motion.css", "tokens-utilities.css"];
const rules = sheets.flatMap((file, index) =>
  parse(read(file), importedLayer(globals, file), null, index * 10_000),
);

type Mode = "screen" | "print" | "reduced-motion";

function applies(media: string | null, mode: Mode): boolean {
  if (media === null) return true;
  return media.split(",").some((query) => {
    const q = query.trim();
    return (
      (mode === "print" && q === "print") ||
      (mode === "reduced-motion" && q === "(prefers-reduced-motion: reduce)")
    );
  });
}

/**
 * The value a property computes to for a selector in a mode, by the cascade: an unlayered rule
 * beats a layered one whatever its position; within the same layer the later rule wins.
 */
function computed(selector: string, property: string, mode: Mode): string | undefined {
  const matching = rules
    .filter((rule) => rule.selectors.includes(selector) && applies(rule.media, mode))
    .filter((rule) => rule.declarations.has(property));
  matching.sort((a, b) => {
    const layerRank = Number(a.layer === null) - Number(b.layer === null);
    return layerRank !== 0 ? layerRank : a.order - b.order;
  });
  return matching.at(-1)?.declarations.get(property);
}

const HELPERS = [
  ".cv-auto",
  ".catalog-virtualized-list > li",
  ".admin-data-table-virtualized tbody tr",
];

describe("content-visibility helpers, as the cascade computes them", () => {
  it.each(HELPERS)("%s defers painting on screen", (selector) => {
    expect(computed(selector, "content-visibility", "screen")).toBe("auto");
  });

  it.each(
    HELPERS.flatMap((selector) =>
      (["print", "reduced-motion"] as const).map((mode) => [selector, mode] as const),
    ),
  )("%s paints in full in %s", (selector, mode) => {
    expect(computed(selector, "content-visibility", mode)).toBe("visible");
  });

  it("remember a section's real height rather than reserving a fixed blank band", () => {
    for (const selector of HELPERS) {
      expect(computed(selector, "contain-intrinsic-size", "screen")).toMatch(/^auto\s/);
    }
  });

  it("is checked against the real layering: the two lists sit in an unlayered file", () => {
    const lists = rules.filter((rule) => rule.selectors.includes(".catalog-virtualized-list > li"));
    expect(lists.every((rule) => rule.layer === null)).toBe(true);
    const helper = rules.filter((rule) => rule.selectors.includes(".cv-auto"));
    expect(helper.every((rule) => rule.layer === "base")).toBe(true);
  });
});
