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
const theme = readFileSync(path.join(here, "theme.css"), "utf8");

/** A row stagger, row enter animation or hand-written tab fade (docs/design/motion.md, MO11). */
const STAGGER =
  /animation-delay|transition-delay|\bdelay-\d+\b|stagger|row-enter|tab-crossfade|nth-child\([^)]*\)[^{]*\{[^}]*animation/;
/** A literal duration: Tailwind `duration-150`, or a `150ms` inside an animation or transition. */
const LITERAL = /\bduration-\d+\b|(?:animation|transition)[^;\n]*\b\d+(?:\.\d+)?m?s\b/;

/**
 * Staff kit files that still carry a literal duration from before the motion tokens. Tracked as a
 * follow-up toward "tokens only"; the list only shrinks (a fixed file must leave it), and nothing
 * new may join it. The returned-row tint's `2s` is the one deliberate exception.
 */
const KNOWN_LITERALS = [
  "data/data-table.tsx",
  "display/checklist.tsx",
  "display/image-gallery.tsx",
  "display/progress-bar.tsx",
  "forms/file-dropzone.tsx",
  "forms/upload-queue.tsx",
  "shell/nav-scroll-area.tsx",
  "shell/sidebar-nav.tsx",
  "shell/staff-shell.tsx",
  "theme.css",
];

describe("staff kit motion (docs/design/motion.md, MO11)", () => {
  it("has no row stagger, row enter animation or local tab fade", () => {
    expect(files.filter((f) => STAGGER.test(readFileSync(f, "utf8"))).map(rel)).toEqual([]);
  });

  it("keeps the returned-row tint, colour only", () => {
    expect(theme).toMatch(/\[data-staff-returned\]\s*\{\s*animation: staff-row-returned/);
    expect(theme).toMatch(/@keyframes staff-row-returned\s*\{\s*from \{\s*background-color/);
  });

  it("switches a tab's selected mark at once: no colour transition on a staff tab trigger", () => {
    expect(theme).toMatch(/\[data-staff-ui\] \[role="tab"\] \{\s*transition: none;\s*\}/);
  });

  it("adds no new literal duration; motion runs on the --lax-motion-* tokens", () => {
    const literal = files.filter((f) => LITERAL.test(readFileSync(f, "utf8"))).map(rel);
    expect(literal.sort()).toEqual(KNOWN_LITERALS);
  });
});
