import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const motion = readFileSync(join(here, "tokens-motion.css"), "utf8");
const utilities = readFileSync(join(here, "tokens-utilities.css"), "utf8");

describe("content-visibility helpers", () => {
  it("remember a section's real height rather than reserving a fixed blank band", () => {
    expect(motion).toMatch(/\.cv-auto\s*{[^}]*contain-intrinsic-size:\s*auto\s/);
    expect(utilities).toMatch(
      /\.catalog-virtualized-list > li\s*{[^}]*contain-intrinsic-size:\s*auto\s/,
    );
  });

  it("are switched off for print and reduced motion, so nothing draws as a placeholder", () => {
    const rule = motion.slice(motion.indexOf("@media print, (prefers-reduced-motion: reduce)"));
    expect(rule).toContain(".cv-auto");
    expect(rule).toContain(".catalog-virtualized-list > li");
    expect(rule).toContain(".admin-data-table-virtualized tbody tr");
    expect(rule).toMatch(/content-visibility:\s*visible/);
  });
});
