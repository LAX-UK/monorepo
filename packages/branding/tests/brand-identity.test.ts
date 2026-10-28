import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BRAND_COLORS,
  BRAND_SURFACES,
  PRODUCT_ACCENTS,
  PRODUCT_ACCENTS_ON_DARK,
} from "../src/brand-identity.js";

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Account's real page and surface tokens (apps/account/src/app/globals.css). */
const ACCOUNT_LIGHT_SURFACE = "#ffffff";
const ACCOUNT_DARK_PAGE = "#121414";
const ACCOUNT_DARK_SURFACE = "#1a1c1c";

describe("PRODUCT_ACCENTS", () => {
  it("gives LAX Bid the midnight accent", () => {
    expect(PRODUCT_ACCENTS.bid).toBe(BRAND_COLORS.midnight);
  });

  it("gives LAX Account deep teal on light and bright teal on dark", () => {
    expect(PRODUCT_ACCENTS.account).toBe("#0f766e");
    expect(PRODUCT_ACCENTS_ON_DARK.account).toBe("#2dd4bf");
  });

  it("never shares an accent between products, on light or dark", () => {
    const chosen = [
      ...Object.values(PRODUCT_ACCENTS),
      ...Object.values(PRODUCT_ACCENTS_ON_DARK),
    ].filter((accent) => accent !== null);
    expect(new Set(chosen.map((accent) => accent.toLowerCase())).size).toBe(chosen.length);
  });

  it("keeps product accents out of the shared palette", () => {
    const shared = [BRAND_COLORS.obsidian, BRAND_COLORS.lightGray, BRAND_COLORS.lightCream];
    for (const accent of [
      ...Object.values(PRODUCT_ACCENTS),
      ...Object.values(PRODUCT_ACCENTS_ON_DARK),
    ]) {
      if (accent !== null) expect(shared).not.toContain(accent);
    }
  });

  it("only defines a dark accent for products that have a light one", () => {
    for (const product of Object.keys(
      PRODUCT_ACCENTS_ON_DARK,
    ) as (keyof typeof PRODUCT_ACCENTS)[]) {
      if (PRODUCT_ACCENTS_ON_DARK[product] !== null) {
        expect(PRODUCT_ACCENTS[product]).not.toBeNull();
      }
    }
  });

  it("keeps Account's teal at WCAG AA contrast on its real surfaces", () => {
    const light = PRODUCT_ACCENTS.account ?? "";
    const dark = PRODUCT_ACCENTS_ON_DARK.account ?? "";
    expect(contrast(light, ACCOUNT_LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark, ACCOUNT_DARK_PAGE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark, ACCOUNT_DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps Bid's name readable as text on Account's light and dark surfaces", () => {
    expect(contrast(PRODUCT_ACCENTS.bid ?? "", ACCOUNT_LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5);
    const dark = PRODUCT_ACCENTS_ON_DARK.bid ?? "";
    expect(contrast(dark, ACCOUNT_DARK_PAGE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark, ACCOUNT_DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a readable label on Account's teal primary button in both themes", () => {
    expect(contrast("#ffffff", PRODUCT_ACCENTS.account ?? "")).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(BRAND_COLORS.obsidian, PRODUCT_ACCENTS_ON_DARK.account ?? ""),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps navy and teal exclusive to their own product", () => {
    const entries = Object.entries(PRODUCT_ACCENTS);
    for (const [product, accent] of entries) {
      if (accent === BRAND_COLORS.midnight) expect(product).toBe("bid");
      if (accent === "#0f766e") expect(product).toBe("account");
    }
  });
});

describe("BRAND_SURFACES", () => {
  const primitives = readFileSync(
    fileURLToPath(new URL("../public/brand-primitives.css", import.meta.url)),
    "utf8",
  );

  it("mirrors the light paper in the CSS primitives", () => {
    expect(primitives).toContain(`--brand-paper: ${BRAND_SURFACES.paper};`);
  });

  it("mirrors the dark-mode paper in the CSS primitives", () => {
    expect(primitives).toContain(`--brand-paper-on-dark: ${BRAND_SURFACES.paperOnDark};`);
  });

  it("keeps ink text readable on paper and cream text readable on dark paper", () => {
    expect(contrast(BRAND_COLORS.obsidian, BRAND_SURFACES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(BRAND_COLORS.lightCream, BRAND_SURFACES.paperOnDark)).toBeGreaterThanOrEqual(
      4.5,
    );
    // Body and secondary text in both products: #474747 on light paper, #c9c5bc on dark paper.
    expect(contrast("#474747", BRAND_SURFACES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#c9c5bc", BRAND_SURFACES.paperOnDark)).toBeGreaterThanOrEqual(4.5);
  });
});
