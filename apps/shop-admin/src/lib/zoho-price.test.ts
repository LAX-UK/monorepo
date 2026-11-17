import { describe, expect, it } from "vitest";
import { compareWithZohoPrice, zohoPriceLabel, zohoPriceMinor } from "./zoho-price";

describe("zohoPriceLabel", () => {
  it("shows Zoho's price in pounds", () => {
    expect(zohoPriceLabel("4800.00")).toBe("£4,800.00");
    expect(zohoPriceLabel("250.5")).toBe("£250.50");
  });

  it("shows nothing when Zoho has no price worth showing", () => {
    expect(zohoPriceLabel(null)).toBeNull();
    expect(zohoPriceLabel("0.00")).toBeNull();
    expect(zohoPriceLabel("abc")).toBeNull();
  });
});

describe("compareWithZohoPrice", () => {
  it("does not flag a price that matches Zoho's, however it is typed", () => {
    expect(compareWithZohoPrice("4800.00", "4800")).toEqual({ label: "£4,800.00", differs: false });
    expect(compareWithZohoPrice("4800.00", "£4,800.00").differs).toBe(false);
  });

  it("flags a price that differs from Zoho's", () => {
    expect(compareWithZohoPrice("4800.00", "3900")).toEqual({ label: "£4,800.00", differs: true });
  });

  it("does not compare a price that is blank or not an amount yet", () => {
    expect(compareWithZohoPrice("4800.00", "").differs).toBe(false);
    expect(compareWithZohoPrice("4800.00", "abc").differs).toBe(false);
  });

  it("has nothing to flag when Zoho has no price", () => {
    expect(compareWithZohoPrice(null, "3900")).toEqual({ label: null, differs: false });
  });
});

describe("zohoPriceMinor", () => {
  it("is Zoho's price in pence, for sorting", () => {
    expect(zohoPriceMinor("4800.00")).toBe(480000);
    expect(zohoPriceMinor("250.5")).toBe(25050);
  });

  it("is null when Zoho has no price, so unpriced works sort together", () => {
    expect(zohoPriceMinor(null)).toBeNull();
    expect(zohoPriceMinor("0.00")).toBeNull();
    expect(zohoPriceMinor("abc")).toBeNull();
  });
});
