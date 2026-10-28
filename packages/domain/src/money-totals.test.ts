import { describe, expect, it } from "vitest";
import { sumEstimatesByCurrency, sumMoneyByCurrency } from "./money-totals.js";

describe("money totals", () => {
  it("adds per currency without mixing them, exactly to the penny", () => {
    expect(
      sumMoneyByCurrency([
        { currency: "GBP", amount: "0.10" },
        { currency: "eur", amount: "1500" },
        { currency: "GBP", amount: "0.20" },
        { currency: "EUR", amount: "250.55" },
      ]),
    ).toEqual([
      { currency: "GBP", amount: "0.30" },
      { currency: "EUR", amount: "1750.55" },
    ]);
  });

  it("drops currencies that add up to nothing, so nothing never reads as £0.00", () => {
    expect(sumMoneyByCurrency([{ currency: "GBP", amount: "0.00" }])).toEqual([]);
  });

  it("falls back to pounds for a missing or malformed code", () => {
    expect(sumMoneyByCurrency([{ currency: "", amount: "5" }])).toEqual([
      { currency: "GBP", amount: "5.00" },
    ]);
  });

  it("adds estimate ranges per currency", () => {
    expect(
      sumEstimatesByCurrency([
        { currency: "GBP", low: "1000", high: "1500" },
        { currency: "GBP", low: "200.50", high: "300" },
      ]),
    ).toEqual([{ currency: "GBP", low: "1200.50", high: "1800.00" }]);
  });
});
