import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

const files = sources(here);
const rel = (f: string) => path.relative(here, f);

const STAGGER =
  /animation-delay|transition-delay|\bdelay-\d+\b|stagger|row-enter|tab-crossfade|nth-child\([^)]*\)[^{]*\{[^}]*animation/;
const LITERAL = /\bduration-\d+\b|(?:animation|transition)[^;\n]*\b\d+(?:\.\d+)?m?s\b/;

/** Files with a literal duration from before the motion tokens; the list only shrinks. */
const KNOWN_LITERALS = ["components/artworks/artwork-media-field.client.tsx"];

/**
 * LAX Admin moves less (docs/design/motion.md, MO11): rows never stagger or enter, and its panels,
 * drawers and tab content take their timing from the kit's staff tokens, not literals.
 */
describe("LAX Admin motion", () => {
  it("has no row stagger, row enter animation or local tab fade", () => {
    expect(files.filter((f) => STAGGER.test(readFileSync(f, "utf8"))).map(rel)).toEqual([]);
  });

  it("adds no new literal duration", () => {
    const literal = files.filter((f) => LITERAL.test(readFileSync(f, "utf8"))).map(rel);
    expect(literal.sort()).toEqual(KNOWN_LITERALS);
  });
});
