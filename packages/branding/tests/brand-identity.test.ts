import { describe, expect, it } from "vitest";
import { BRAND_COLORS, PRODUCT_ACCENTS } from "../src/brand-identity.js";

describe("PRODUCT_ACCENTS", () => {
  it("gives LAX Bid the midnight accent", () => {
    expect(PRODUCT_ACCENTS.bid).toBe(BRAND_COLORS.midnight);
  });

  it("never shares an accent between products", () => {
    const chosen = Object.values(PRODUCT_ACCENTS).filter((accent) => accent !== null);
    expect(new Set(chosen.map((accent) => accent.toLowerCase())).size).toBe(chosen.length);
  });

  it("keeps product accents out of the shared palette", () => {
    const shared = [BRAND_COLORS.obsidian, BRAND_COLORS.lightGray, BRAND_COLORS.lightCream];
    for (const accent of Object.values(PRODUCT_ACCENTS)) {
      if (accent !== null) expect(shared).not.toContain(accent);
    }
  });
});
