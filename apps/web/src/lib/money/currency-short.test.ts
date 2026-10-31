import { describe, expect, it } from "vitest";
import { formatEstimateRangeShort, formatWholeMoney } from "./currency";

describe("list figure money", () => {
  it("writes whole units and an estimate with the symbol once", () => {
    expect(formatWholeMoney("9200.00", "GBP")).toBe("£9,200");
    expect(formatEstimateRangeShort({ low: "8000", high: "12000", currency: "GBP" })).toBe(
      "£8,000–12,000",
    );
    expect(formatEstimateRangeShort({ low: "x", high: "12000", currency: "GBP" })).toBe("—");
  });
});
