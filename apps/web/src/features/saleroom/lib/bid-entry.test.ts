import {
  bidIncrementOptions,
  minNextBidAmount,
  validateBidAmount,
  validatePaddleNumber,
} from "@/features/saleroom/lib/bid-entry";
import { describe, expect, it } from "vitest";

describe("bid-entry", () => {
  it("computes min next bid from current price and increment", () => {
    expect(minNextBidAmount("100.00", "10.00")).toBe(110);
  });

  it("offers increment chip amounts", () => {
    const options = bidIncrementOptions("100.00", "10.00");
    expect(options).toEqual([110, 120, 150]);
  });

  it("rejects bids below minimum", () => {
    expect(validateBidAmount(105, "100.00", "10.00")).toMatch(/at least/);
  });

  it("accepts valid paddle numbers", () => {
    expect(validatePaddleNumber("142")).toBeNull();
    expect(validatePaddleNumber("12")).not.toBeNull();
  });
});
