import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const adminSrc = path.resolve(here, "../../../apps/shop-admin/src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

const files = [...sources(here), ...sources(adminSrc)];
const theme = readFileSync(path.join(here, "theme.css"), "utf8");

/** Staff tools move less (docs/design/motion.md, MO11): LAX Admin rows never stagger or enter. */
describe("LAX Admin and the staff kit motion", () => {
  it("has no row stagger, row enter animation or local tab fade", () => {
    const offenders = files.filter((f) =>
      /animation-delay|transition-delay|stagger|row-enter|tab-crossfade|nth-child\([^)]*\)[^{]*\{[^}]*animation/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the returned-row tint, colour only", () => {
    expect(theme).toMatch(/\[data-staff-returned\]\s*\{\s*animation: staff-row-returned/);
    expect(theme).toMatch(/@keyframes staff-row-returned\s*\{\s*from \{\s*background-color/);
  });

  it("times its tab panels, panels and drawers from the motion tokens, not literals", () => {
    const literal = /data-lax-motion[^\n]*\d+m?s|animation:[^;\n]*\b\d+(\.\d+)?m?s\b[^;\n]*lax-/;
    expect(files.filter((f) => literal.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
