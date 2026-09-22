import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS, BRAND_FONTS } from "../src/brand-identity.js";
import { SITE_COMPANY_NAME, SITE_THEME_COLOR_DARK, SITE_THEME_COLOR_LIGHT } from "../src/site.js";
import {
  COLORS,
  FONT_STACK_BODY,
  FONT_STACK_HEADING,
  FONT_STACK_SUPPORTING,
} from "../src/tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCssVar(css: string, name: string): string | undefined {
  const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^;]+);`);
  const m = css.match(re);
  return m?.[1]?.trim();
}

describe("BRAND_COLORS (Brand Identity v1.0)", () => {
  it("defines canonical brand hex values", () => {
    expect(BRAND_COLORS.obsidian).toBe("#000000");
    expect(BRAND_COLORS.midnight).toBe("#091f5b");
    expect(BRAND_COLORS.lightGray).toBe("#b8b9c0");
    expect(BRAND_COLORS.lightCream).toBe("#f2f1df");
  });
});

describe("COLORS vs apps/web globals.css @theme (light)", () => {
  const globalsPath = join(__dirname, "../../../apps/web/src/app/globals.css");
  const css = readFileSync(globalsPath, "utf8");
  /** Slice light @theme block only (before `html.dark`) */
  const lightBlock = css.split("html.dark")[0] ?? css;

  const brandPrimitiveCases: [keyof typeof BRAND_COLORS, string][] = [
    ["obsidian", "--color-brand-obsidian"],
    ["midnight", "--color-brand-midnight"],
    ["lightGray", "--color-brand-light-gray"],
    ["lightCream", "--color-brand-light-cream"],
  ];

  it.each(brandPrimitiveCases)("BRAND_COLORS.%s matches %s", (key, varName) => {
    const fromCss = parseCssVar(lightBlock, varName);
    expect(fromCss).toBeDefined();
    expect(BRAND_COLORS[key]).toBe(fromCss);
  });

  const cases: [keyof typeof COLORS, string][] = [
    ["ink", "--color-brand-900"],
    ["pageBg", "--color-page-bg"],
    ["paper", "--color-paper"],
    ["surface", "--color-surface-container-lowest"],
    ["textPrimary", "--color-brand-500"],
    ["textSecondary", "--color-brand-400"],
    ["textMuted", "--color-brand-300"],
    ["border", "--color-nav-border"],
    ["borderSoft", "--color-footer-soft"],
    ["link", "--color-link"],
    ["gold", "--color-accent-gold"],
    ["red", "--color-live-red"],
    ["ctaBg", "--color-cta-bg"],
    ["ctaOn", "--color-cta-on"],
  ];

  it.each(cases)("COLORS.%s matches %s", (key, varName) => {
    const fromCss = parseCssVar(lightBlock, varName);
    if (fromCss === undefined) {
      throw new Error(`Missing CSS variable ${varName}`);
    }
    const cssValue = fromCss;
    const expected = COLORS[key];
    // Semantic tokens may reference brand primitives via var()
    if (cssValue.startsWith("var(")) {
      const ref = cssValue.match(/var\((--color-brand-[^)]+)\)/)?.[1];
      if (ref === undefined) {
        throw new Error(`Missing brand primitive reference in ${cssValue}`);
      }
      expect(parseCssVar(lightBlock, ref)).toBe(expected);
    } else {
      expect(expected).toBe(cssValue);
    }
  });

  it("SITE_THEME_COLOR_LIGHT matches page-bg shell token", () => {
    expect(SITE_THEME_COLOR_LIGHT).toBe(COLORS.pageBg);
    expect(parseCssVar(lightBlock, "--color-page-bg")).toBe("#ffffff");
  });

  it("paper token maps to brand light cream for email", () => {
    expect(COLORS.paper).toBe(BRAND_COLORS.lightCream);
    expect(parseCssVar(lightBlock, "--color-paper")).toBe("var(--color-brand-light-cream)");
  });

  it("graphite matches brand-400 (same as textSecondary)", () => {
    expect(COLORS.graphite).toBe(COLORS.textSecondary);
  });

  it("primary and secondary map to brand obsidian and midnight", () => {
    expect(parseCssVar(lightBlock, "--color-primary")).toBe("var(--color-brand-obsidian)");
    expect(parseCssVar(lightBlock, "--color-secondary")).toBe("var(--color-brand-midnight)");
  });

  it("accent-buying uses gold, not primary", () => {
    expect(parseCssVar(lightBlock, "--color-accent-buying")).toBe("var(--color-accent-gold)");
  });
});

describe("globals.css accent-brand (light vs dark)", () => {
  const globalsPath = join(__dirname, "../../../apps/web/src/app/globals.css");
  const darkTokensPath = join(__dirname, "../../../apps/web/src/styles/tokens-dark.css");
  const css = readFileSync(globalsPath, "utf8");
  const darkCss = readFileSync(darkTokensPath, "utf8");
  const lightBlock = css.split("html.dark")[0] ?? "";

  it("light theme defines blue accent + brand alias", () => {
    expect(parseCssVar(lightBlock, "--color-accent-blue")).toBe("#2b7fff");
    expect(parseCssVar(lightBlock, "--color-accent-brand")).toBe("var(--color-accent-blue)");
  });

  it("dark theme maps accent-brand to gold token", () => {
    expect(darkCss).toContain("--color-accent-brand: var(--color-accent-gold)");
  });
});

describe("globals.css typography tokens", () => {
  const globalsPath = join(__dirname, "../../../apps/web/src/app/globals.css");
  const css = readFileSync(globalsPath, "utf8");
  const lightBlock = css.split("html.dark")[0] ?? css;

  it("maps headline/body/label to Montserrat", () => {
    for (const token of ["--font-headline", "--font-body", "--font-label"] as const) {
      expect(parseCssVar(lightBlock, token)).toContain("--font-montserrat");
    }
  });

  it("maps supporting/footer fonts to Outfit", () => {
    for (const token of ["--font-supporting", "--font-footer-links"] as const) {
      expect(parseCssVar(lightBlock, token)).toContain("--font-outfit");
    }
  });

  it("email font stacks lead with brand typefaces", () => {
    expect(FONT_STACK_BODY).toContain(BRAND_FONTS.primary);
    expect(FONT_STACK_BODY).toContain(BRAND_FONTS.secondary);
    expect(FONT_STACK_HEADING).toContain(BRAND_FONTS.primary);
    expect(FONT_STACK_SUPPORTING).toContain(BRAND_FONTS.secondary);
  });
});

describe("apps/shop base.css @theme brand primitives", () => {
  const shopBasePath = join(__dirname, "../../../apps/shop/src/app/base.css");
  const css = readFileSync(shopBasePath, "utf8");

  const brandPrimitiveCases: [keyof typeof BRAND_COLORS, string][] = [
    ["obsidian", "--color-brand-obsidian"],
    ["midnight", "--color-brand-midnight"],
    ["lightGray", "--color-brand-light-gray"],
    ["lightCream", "--color-brand-light-cream"],
  ];

  it.each(brandPrimitiveCases)("Shop %s resolves to BRAND_COLORS", (_key, varName) => {
    const fromCss = parseCssVar(css, varName);
    expect(fromCss).toBeDefined();
    expect(fromCss).toMatch(/var\(--brand-/);
  });

  it("uses Bid-aligned container width tokens", () => {
    expect(parseCssVar(css, "--container-max")).toBe("90rem");
    expect(parseCssVar(css, "--container-inner")).toBe("86rem");
  });
});

describe("issuer-hosted auth chrome mirrors Brand Identity", () => {
  const hostedTokens = readFileSync(
    join(__dirname, "../../../packages/auth/src/hosted-auth/tokens.ts"),
    "utf8",
  );

  it("locks Identity login tokens to branding SSOT without a package import", () => {
    expect(hostedTokens).toContain(`obsidian: "${BRAND_COLORS.obsidian}"`);
    expect(hostedTokens).toContain(`midnight: "${BRAND_COLORS.midnight}"`);
    expect(hostedTokens).toContain(`lightCream: "${BRAND_COLORS.lightCream}"`);
    expect(hostedTokens).toContain(`pageBg: "${COLORS.pageBg}"`);
    expect(hostedTokens).toContain(`ink: "${COLORS.textPrimary}"`);
    expect(hostedTokens).toContain(`textSecondary: "${COLORS.textSecondary}"`);
    expect(hostedTokens).toContain(FONT_STACK_BODY);
    expect(hostedTokens).toContain(FONT_STACK_SUPPORTING);
    expect(hostedTokens).toContain(`companyName: "${SITE_COMPANY_NAME}"`);
    expect(hostedTokens).toContain(`darkPageBg: "${SITE_THEME_COLOR_DARK}"`);
  });
});

describe("issuer-hosted Shop logo stays in lockstep with the storefront mark", () => {
  it("matches the Shop public SVG byte-for-byte", () => {
    const shopLogo = readFileSync(
      join(__dirname, "../../../apps/shop/public/shop/lax-shop-logo.svg"),
    );
    const issuerLogo = readFileSync(
      join(__dirname, "../../../packages/auth/src/hosted-auth/assets/lax-shop-logo.svg"),
    );
    expect(issuerLogo.equals(shopLogo)).toBe(true);
  });
});
