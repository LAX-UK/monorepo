import { moneyEq, moneyGte, parseMoneyToMinorUnits } from "@auction/validators";
import { describe, expect, it } from "vitest";

describe("money compare helpers", () => {
  it("parses minor units with two decimal places", () => {
    expect(parseMoneyToMinorUnits("1")).toBe(100n);
    expect(parseMoneyToMinorUnits("1.2")).toBe(120n);
    expect(parseMoneyToMinorUnits("1.20")).toBe(120n);
    expect(parseMoneyToMinorUnits("0.01")).toBe(1n);
  });

  it("compares equality without float drift", () => {
    expect(moneyEq("10.00", "10")).toBe(true);
    expect(moneyEq("10.01", "10.00")).toBe(false);
  });

  it("compares gte on strings", () => {
    expect(moneyGte("100.00", "99.99")).toBe(true);
    expect(moneyGte("100", "100.00")).toBe(true);
    expect(moneyGte("10", "10.01")).toBe(false);
  });
});
