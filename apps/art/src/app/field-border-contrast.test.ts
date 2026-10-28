import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(import.meta.dirname, "base.css"), "utf8");
const primitives = readFileSync(
  path.join(import.meta.dirname, "../../../../packages/branding/public/brand-primitives.css"),
  "utf8",
);
const [lightRules = "", darkRules = ""] = css.split("html.dark {");

/** A token's hex value, following one `var(--brand-…)` reference into the shared primitives. */
function token(rules: string, name: string): string {
  const match = rules.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6}|var\\((--[\\w-]+)\\))`));
  if (!match?.[1]) throw new Error(`${name} is not set`);
  if (!match[2]) return match[1];
  return token(primitives, match[2]);
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe("lax.art field edge (WCAG 1.4.11)", () => {
  it.each([
    ["light", lightRules],
    ["dark", darkRules],
  ])("clears 3:1 against the %s page and surfaces", (_theme, rules) => {
    const edge = token(rules, "--color-input-border");
    for (const surface of ["--color-page-bg", "--color-surface", "--color-surface-container-low"]) {
      expect(contrast(edge, token(rules, surface))).toBeGreaterThanOrEqual(3);
    }
  });

  it("draws the secondary button's edge with the field edge", () => {
    expect(lightRules).toContain("--color-button-secondary-border: var(--color-input-border);");
  });
});
