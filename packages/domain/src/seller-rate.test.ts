import { describe, expect, it } from "vitest";
import { notVatRegisteredLine, ratePercentLabel, sellerCommissionTerm } from "./seller-rate.js";

describe("ratePercentLabel", () => {
  it.each([
    [1500, "15%"],
    [1250, "12.5%"],
    [1225, "12.25%"],
    [2000, "20%"],
    [5, "0.05%"],
    [0, "0%"],
    [10_000, "100%"],
  ])("reads %i basis points as %s", (bps, label) => {
    expect(ratePercentLabel(bps)).toBe(label);
  });

  it("refuses a rate that is not whole basis points", () => {
    expect(() => ratePercentLabel(12.5)).toThrow(RangeError);
    expect(() => ratePercentLabel(-1)).toThrow(RangeError);
  });
});

describe("sellerCommissionTerm", () => {
  it("states the agreement's rate on the hammer, plus VAT", () => {
    expect(sellerCommissionTerm("15")).toBe("15% of the hammer price, plus VAT");
    expect(sellerCommissionTerm("12.50")).toBe("12.5% of the hammer price, plus VAT");
  });
});

describe("notVatRegisteredLine", () => {
  it("names the company that does not charge VAT", () => {
    expect(notVatRegisteredLine("London Auction Xchange LTD")).toBe(
      "No VAT: London Auction Xchange LTD is not VAT-registered",
    );
  });
});
