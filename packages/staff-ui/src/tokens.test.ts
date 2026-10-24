import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAFF_CONTROL_HEIGHT, STAFF_RADIUS, STAFF_TYPE_SCALE } from "./tokens.js";

// Vitest runs from the package root.
const css = readFileSync(join(process.cwd(), "src/theme.css"), "utf8");

function token(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
}

/** theme.css is what the browser reads; tokens.ts documents it. They must not drift. */
describe("staff tokens", () => {
  it.each(Object.entries(STAFF_TYPE_SCALE))("type step %s matches the theme", (step, spec) => {
    expect(token(`text-staff-${step}`)).toBe(`${spec.size}px`);
    expect(token(`text-staff-${step}--line-height`)).toBe(`${spec.lineHeight}px`);
  });

  it.each(Object.entries(STAFF_RADIUS))("radius %s matches the theme", (step, spec) => {
    expect(token(`radius-staff-${step}`)).toBe(`${spec.px}px`);
  });

  it.each(Object.entries(STAFF_CONTROL_HEIGHT))("control height %s matches", (step, spec) => {
    expect(token(`spacing-control-${step}`)).toBe(`${spec.px}px`);
  });

  it("keeps every line height on the 4px grid", () => {
    for (const spec of Object.values(STAFF_TYPE_SCALE)) {
      expect(spec.lineHeight % 4).toBe(0);
    }
  });

  it("declares every colour as a light and dark pair", () => {
    const colours = [...css.matchAll(/--color-staff-[\w-]+:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    expect(colours.length).toBeGreaterThan(30);
    for (const value of colours) expect(value).toMatch(/^light-dark\(/);
  });
});
