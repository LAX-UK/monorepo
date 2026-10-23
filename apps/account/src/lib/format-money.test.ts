import { describe, expect, it } from "vitest";
import { formatCurrencyTotals, formatDate, formatMinorUnits } from "./format-money";

describe("formatMinorUnits", () => {
  it("formats pence and cents in their own currency", () => {
    expect(formatMinorUnits(1_240_000, "GBP")).toBe("£12,400.00");
    expect(formatMinorUnits(310_000, "EUR")).toBe("€3,100.00");
  });

  it("respects currencies without minor units", () => {
    expect(formatMinorUnits(5000, "JPY")).toContain("5,000");
  });

  it("shows an unrecognised code beside the plain figure", () => {
    expect(formatMinorUnits(1234, "ZZ9")).toBe("12.34 ZZ9");
  });
});

describe("formatCurrencyTotals", () => {
  it("lists each currency side by side without combining them", () => {
    expect(
      formatCurrencyTotals([
        { currency: "GBP", amount: 100 },
        { currency: "EUR", amount: 200 },
      ]),
    ).toBe("£1.00 · €2.00");
  });
});

describe("formatDate", () => {
  it("formats in British order and reads the date in UTC", () => {
    expect(formatDate("2026-03-01T23:30:00.000Z")).toBe("1 Mar 2026");
  });
});
