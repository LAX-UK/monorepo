import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(import.meta.dirname, "globals.css"), "utf8");
const [lightRules = "", darkRules = ""] = css.split("html.dark {");

function token(rules: string, name: string): string {
  const match = rules.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`${name} is not a hex value`);
  return match[1];
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("success text (WCAG 1.4.3)", () => {
  it.each([
    [
      "light",
      lightRules,
      ["--color-surface", "--color-surface-container-low", "--color-surface-container"],
    ],
    [
      "dark",
      darkRules,
      ["--color-surface", "--color-surface-container-low", "--color-surface-container"],
    ],
  ] as const)("reaches 4.5:1 on %s surfaces", (_theme, rules, surfaces) => {
    const success = token(rules, "--color-success");
    for (const surface of surfaces) {
      expect(contrast(success, token(rules, surface))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
