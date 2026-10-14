import { describe, expect, it } from "vitest";
import {
  MARKETING_CARD_REVEAL,
  MARKETING_SECTION_REVEAL,
  marketingStaggerDelay,
} from "./presets.js";

describe("marketingStaggerDelay", () => {
  it("steps card delays by 70ms up to a 420ms cap", () => {
    expect(marketingStaggerDelay(0, MARKETING_CARD_REVEAL)).toBe(0);
    expect(marketingStaggerDelay(1, MARKETING_CARD_REVEAL)).toBe(70);
    expect(marketingStaggerDelay(6, MARKETING_CARD_REVEAL)).toBe(420);
    expect(marketingStaggerDelay(100, MARKETING_CARD_REVEAL)).toBe(420);
  });

  it("steps section delays by 80ms up to a 160ms cap", () => {
    expect(marketingStaggerDelay(0, MARKETING_SECTION_REVEAL)).toBe(0);
    expect(marketingStaggerDelay(1, MARKETING_SECTION_REVEAL)).toBe(80);
    expect(marketingStaggerDelay(2, MARKETING_SECTION_REVEAL)).toBe(160);
    expect(marketingStaggerDelay(5, MARKETING_SECTION_REVEAL)).toBe(160);
  });

  it("uses rise variant in presets", () => {
    expect(MARKETING_SECTION_REVEAL.variant).toBe("rise");
    expect(MARKETING_CARD_REVEAL.variant).toBe("rise");
  });
});
