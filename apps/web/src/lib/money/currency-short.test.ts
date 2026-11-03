import { describe, expect, it } from "vitest";
import { formatDeduction, formatEstimateRangeShort, formatWholeMoney } from "./currency";

describe("list figure money", () => {
  it("writes whole units and an estimate with the symbol once", () => {
    expect(formatWholeMoney("9200.00", "GBP")).toBe("£9,200");
    expect(formatEstimateRangeShort({ low: "8000", high: "12000", currency: "GBP" })).toBe(
      "£8,000–12,000",
    );
    expect(formatEstimateRangeShort({ low: "x", high: "12000", currency: "GBP" })).toBe("—");
  });
});

describe("formatDeduction", () => {
  it("uses a true minus and pence, whichever way the amount is signed", () => {
    expect(formatDeduction("960", "GBP")).toBe("\u2212£960.00");
    expect(formatDeduction("-960.5", "GBP")).toBe("\u2212£960.50");
    expect(formatDeduction(0, "GBP")).toBe("£0.00");
    expect(formatDeduction("x", "GBP")).toBe("—");
  });
});
