import { describe, expect, it } from "vitest";
import { isArtOriginalRelease, isShopEditionRelease } from "./release-alert.js";

describe("isShopEditionRelease", () => {
  it("counts only editions sold in the Shop", () => {
    expect(isShopEditionRelease({ salesChannel: "shop", eligibleForEditionAllocation: true })).toBe(
      true,
    );
    expect(isShopEditionRelease({ salesChannel: "art", eligibleForEditionAllocation: true })).toBe(
      false,
    );
    expect(
      isShopEditionRelease({ salesChannel: "shop", eligibleForEditionAllocation: false }),
    ).toBe(false);
  });
});

describe("isArtOriginalRelease", () => {
  it("counts an original on lax.art", () => {
    expect(isArtOriginalRelease({ salesChannel: "art", sourceOriginalArtworkId: null })).toBe(true);
  });

  it("leaves out prints made from an original, and anything sold in the Shop", () => {
    expect(isArtOriginalRelease({ salesChannel: "art", sourceOriginalArtworkId: "orig-1" })).toBe(
      false,
    );
    expect(isArtOriginalRelease({ salesChannel: "shop", sourceOriginalArtworkId: null })).toBe(
      false,
    );
  });
});
