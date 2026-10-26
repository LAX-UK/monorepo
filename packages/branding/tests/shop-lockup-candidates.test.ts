import { describe, expect, it } from "vitest";
import { PRODUCT_ACCENTS, PRODUCT_ACCENTS_ON_DARK } from "../src/brand-identity.js";
import { laxDescriptor, laxLockup } from "../src/lockup/lockup.js";
import {
  SHOP_ACCENT_CANDIDATES,
  SHOP_LOCKUP_VARIANTS,
  SHOP_TAG_BELOW,
  shopLockupCandidate,
} from "../src/lockup/shop-lockup-candidates.js";
import { SHOP_TAG_PATHS } from "../src/lockup/shop-tag-paths.js";

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

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Shop's light and dark surfaces (apps/shop/src/app/base.css). */
const LIGHT_SURFACES = ["#ffffff", "#f3f3f3", "#eeeeee"];
const DARK_SURFACES = ["#121414", "#1a1c1c", "#2d2f2e"];

describe("Shop lockup candidates", () => {
  it("keeps the London Art Exchange wordmark whole and adds only the tag", () => {
    const exchange = laxLockup("exchange");
    for (const variant of SHOP_LOCKUP_VARIANTS) {
      const lockup = shopLockupCandidate(variant.id);
      expect(lockup.ink).toEqual(exchange.ink);
      expect(lockup.mist).toEqual(exchange.mist);
      if (variant.id !== "tagBelow") {
        expect(lockup.descriptorPaths).toEqual([{ d: SHOP_TAG_PATHS[variant.id].d }]);
      }
    }
  });

  it("sets the own-line tag with the family's own outlines, moved and scaled as one", () => {
    const family = laxDescriptor("SHOP").paths;
    const lockup = shopLockupCandidate("tagBelow");
    expect(lockup.descriptorPaths.map((path) => path.d)).toEqual(family.map((path) => path.d));
    const prefix = `translate(${Math.round(SHOP_TAG_BELOW.dx * 1000) / 1000} ${
      Math.round(SHOP_TAG_BELOW.dy * 1000) / 1000
    }) scale(${Math.round(SHOP_TAG_BELOW.scale * 1000) / 1000})`;
    for (const path of lockup.descriptorPaths)
      expect(path.transform?.startsWith(prefix)).toBe(true);
    // Four lines: the frame grows below Marylebone (bottom 293.2) by the tag's line.
    const [, top, , height] = lockup.viewBox.split(" ").map(Number);
    expect((top ?? 0) + (height ?? 0)).toBeGreaterThan(365);
  });

  it("frames each tag inside the view box", () => {
    for (const variant of SHOP_LOCKUP_VARIANTS) {
      if (variant.id === "tagBelow") continue;
      const lockup = shopLockupCandidate(variant.id);
      const [, top, width, height] = lockup.viewBox.split(" ").map(Number);
      const { bounds } = SHOP_TAG_PATHS[variant.id];
      expect(bounds.right).toBeLessThanOrEqual(width ?? 0);
      expect(bounds.bottom).toBeLessThanOrEqual((top ?? 0) + (height ?? 0));
    }
  });

  it("offers accents that pass 4.5:1 on every Shop surface and differ from Bid and Account", () => {
    for (const accent of SHOP_ACCENT_CANDIDATES) {
      for (const surface of LIGHT_SURFACES) {
        expect(contrast(accent.light, surface)).toBeGreaterThanOrEqual(4.5);
      }
      for (const surface of DARK_SURFACES) {
        expect(contrast(accent.dark, surface)).toBeGreaterThanOrEqual(4.5);
      }
      const taken = [
        PRODUCT_ACCENTS.bid,
        PRODUCT_ACCENTS.account,
        PRODUCT_ACCENTS_ON_DARK.bid,
        PRODUCT_ACCENTS_ON_DARK.account,
      ];
      expect(taken).not.toContain(accent.light);
      expect(taken).not.toContain(accent.dark);
    }
  });

  it("leaves Shop's live accent unset until one is chosen", () => {
    expect(PRODUCT_ACCENTS.shop).toBeNull();
  });
});
