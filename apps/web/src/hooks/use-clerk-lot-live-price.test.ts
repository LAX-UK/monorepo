import { minNextBidAmount } from "@/hooks/use-clerk-lot-live-price";
import { describe, expect, it } from "vitest";

describe("minNextBidAmount", () => {
  it("adds increment to current price", () => {
    expect(minNextBidAmount("100.00", "10.00")).toBe(110);
  });

  it("falls back to 0.01 increment when invalid", () => {
    expect(minNextBidAmount("50.00", "bad")).toBeCloseTo(50.01, 2);
  });
});
