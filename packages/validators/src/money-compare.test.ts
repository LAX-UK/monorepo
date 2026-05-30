import { describe, expect, it } from "vitest";
import {
  addMoneyStrings,
  minMoneyStrings,
  moneyLt,
  numberToMinorUnits,
  numberToMoneyString,
  parseMoneyToMinorUnits,
} from "./money-compare.js";

describe("money-compare", () => {
  it("parses decimal strings to minor units without float drift", () => {
    expect(parseMoneyToMinorUnits("100.00")).toBe(10000n);
    expect(parseMoneyToMinorUnits("100.01")).toBe(10001n);
  });

  it("converts numbers to money strings via minor units", () => {
    expect(numberToMoneyString(101)).toBe("101.00");
    expect(numberToMoneyString(100.1)).toBe("100.10");
  });

  it("compares money strings without floating point", () => {
    expect(moneyLt("100.00", "101.00")).toBe(true);
    expect(moneyLt("101.00", "100.99")).toBe(false);
  });

  it("adds and mins money strings", () => {
    expect(addMoneyStrings("100.00", "1.00")).toBe("101.00");
    expect(minMoneyStrings("500.00", "310.00")).toBe("310.00");
  });

  it("numberToMinorUnits rounds half-up at cent precision", () => {
    expect(numberToMinorUnits(10.005)).toBe(1001n);
  });
});
