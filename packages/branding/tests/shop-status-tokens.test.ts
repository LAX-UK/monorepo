import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_GLOBALS = join(__dirname, "../../../apps/web/src/app/globals.css");
const WEB_DARK = join(__dirname, "../../../apps/web/src/styles/tokens-dark.css");
const SHOP_BASE = join(__dirname, "../../../apps/shop/src/app/base.css");

const STATUS_TOKENS = [
  "--color-brand-100",
  "--color-live-red",
  "--color-success",
  "--color-success-container",
  "--color-info",
  "--color-info-container",
  "--color-warning",
  "--color-warning-container",
  "--color-danger",
  "--color-danger-container",
] as const;

/** Shop storefront status chips need higher light-mode contrast than Bid admin surfaces. */
const SHOP_LIGHT_STATUS_OVERRIDES: Partial<Record<(typeof STATUS_TOKENS)[number], string>> = {
  "--color-warning": "oklch(0.48 0.14 55)",
};

function parseCssVar(css: string, name: string): string | undefined {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^;]+);`);
  const m = css.match(re);
  return m?.[1]?.trim();
}

function extractDarkBlock(css: string): string {
  const start = css.indexOf("html.dark");
  if (start < 0) return css;
  return css.slice(start);
}

describe("Shop status token drift guardrail", () => {
  const webLight = readFileSync(WEB_GLOBALS, "utf8");
  const webDark = readFileSync(WEB_DARK, "utf8");
  const shopCss = readFileSync(SHOP_BASE, "utf8");
  const shopDark = extractDarkBlock(shopCss);

  for (const token of STATUS_TOKENS) {
    it(`Shop light ${token} matches Bid`, () => {
      const shopVal = parseCssVar(shopCss, token);
      const override = SHOP_LIGHT_STATUS_OVERRIDES[token];
      if (override !== undefined) {
        expect(shopVal).toBe(override);
        return;
      }
      expect(shopVal).toBe(parseCssVar(webLight, token));
    });
  }

  for (const token of STATUS_TOKENS) {
    it(`Shop dark ${token} matches Bid when Bid defines a dark override`, () => {
      const webDarkVal = parseCssVar(webDark, token);
      if (webDarkVal === undefined) return;
      expect(parseCssVar(shopDark, token)).toBe(webDarkVal);
    });
  }
});
