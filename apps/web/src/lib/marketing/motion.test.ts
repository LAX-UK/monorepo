import { describe, expect, it } from "vitest";
import { MARKETING_CARD_REVEAL, MARKETING_SECTION_REVEAL, marketingStaggerDelay } from "./motion";

describe("marketingStaggerDelay", () => {
  it("steps card delays by 50ms up to 150ms cap", () => {
    expect(marketingStaggerDelay(0, MARKETING_CARD_REVEAL)).toBe(0);
    expect(marketingStaggerDelay(1, MARKETING_CARD_REVEAL)).toBe(50);
    expect(marketingStaggerDelay(3, MARKETING_CARD_REVEAL)).toBe(150);
    expect(marketingStaggerDelay(10, MARKETING_CARD_REVEAL)).toBe(150);
  });

  it("steps section delays by 60ms up to 120ms cap", () => {
    expect(marketingStaggerDelay(0, MARKETING_SECTION_REVEAL)).toBe(0);
    expect(marketingStaggerDelay(1, MARKETING_SECTION_REVEAL)).toBe(60);
    expect(marketingStaggerDelay(2, MARKETING_SECTION_REVEAL)).toBe(120);
    expect(marketingStaggerDelay(5, MARKETING_SECTION_REVEAL)).toBe(120);
  });
});
