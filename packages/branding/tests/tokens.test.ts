import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SITE_THEME_COLOR_LIGHT } from "../src/site.js";
import { COLORS } from "../src/tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCssVar(css: string, name: string): string | undefined {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^;]+);`);
  const m = css.match(re);
  return m?.[1]?.trim();
}

describe("COLORS vs apps/web globals.css @theme (light)", () => {
  const globalsPath = join(__dirname, "../../../apps/web/src/app/globals.css");
  const css = readFileSync(globalsPath, "utf8");
  /** Slice light @theme block only (before `html.dark`) */
  const lightBlock = css.split("html.dark")[0] ?? css;

  const cases: [keyof typeof COLORS, string][] = [
    ["ink", "--color-brand-900"],
    ["paper", "--color-page-bg"],
    ["surface", "--color-surface-container-lowest"],
    ["textPrimary", "--color-brand-500"],
    ["textSecondary", "--color-brand-400"],
    ["textMuted", "--color-brand-300"],
    ["border", "--color-nav-border"],
    ["borderSoft", "--color-footer-soft"],
    ["gold", "--color-accent-gold"],
    ["red", "--color-live-red"],
    ["ctaBg", "--color-cta-bg"],
    ["ctaOn", "--color-cta-on"],
  ];

  it.each(cases)("COLORS.%s matches %s", (key, varName) => {
    const fromCss = parseCssVar(lightBlock, varName);
    expect(fromCss).toBeDefined();
    expect(COLORS[key]).toBe(fromCss);
  });

  it("SITE_THEME_COLOR_LIGHT matches page-bg token", () => {
    expect(SITE_THEME_COLOR_LIGHT).toBe(parseCssVar(lightBlock, "--color-page-bg"));
  });

  it("graphite matches brand-400 (same as textSecondary)", () => {
    expect(COLORS.graphite).toBe(COLORS.textSecondary);
  });
});

describe("globals.css accent-brand (light vs dark)", () => {
  const globalsPath = join(__dirname, "../../../apps/web/src/app/globals.css");
  const css = readFileSync(globalsPath, "utf8");
  const lightBlock = css.split("html.dark")[0] ?? "";
  const darkIdx = css.indexOf("html.dark");
  const pulseIdx = css.indexOf("@keyframes accent-pulse");
  const darkSlice = darkIdx >= 0 && pulseIdx > darkIdx ? css.slice(darkIdx, pulseIdx) : "";

  it("light theme defines blue accent + brand alias", () => {
    expect(parseCssVar(lightBlock, "--color-accent-blue")).toBe("#2b7fff");
    expect(parseCssVar(lightBlock, "--color-accent-brand")).toBe("var(--color-accent-blue)");
  });

  it("dark theme maps accent-brand to gold token", () => {
    expect(darkSlice).toContain("--color-accent-brand: var(--color-accent-gold)");
  });
});
