import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS, BRAND_FONTS } from "../src/brand-identity.js";
import { COLORS } from "../src/tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const eventTokensPath = join(__dirname, "../../../apps/event/public/brand-tokens.css");

function parseCssVar(css: string, name: string): string | undefined {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^;]+);`);
  const m = css.match(re);
  return m?.[1]?.trim();
}

describe("apps/event brand-tokens.css drift guardrail", () => {
  const css = readFileSync(eventTokensPath, "utf8");

  it("mirrors brand primitive colors", () => {
    expect(parseCssVar(css, "--brand-obsidian")).toBe(BRAND_COLORS.obsidian);
    expect(parseCssVar(css, "--brand-midnight")).toBe(BRAND_COLORS.midnight);
    expect(parseCssVar(css, "--brand-light-gray")).toBe(BRAND_COLORS.lightGray);
    expect(parseCssVar(css, "--brand-light-cream")).toBe(BRAND_COLORS.lightCream);
  });

  it("mirrors semantic ink and accent gold", () => {
    expect(parseCssVar(css, "--brand-ink")).toBe(COLORS.textPrimary);
    expect(parseCssVar(css, "--brand-accent-gold")).toBe(COLORS.gold);
  });

  it("leads font stacks with brand typefaces", () => {
    const primary = parseCssVar(css, "--font-primary");
    const secondary = parseCssVar(css, "--font-secondary");
    expect(primary).toContain(BRAND_FONTS.primary);
    expect(secondary).toContain(BRAND_FONTS.secondary);
  });
});
