import { describe, expect, it } from "vitest";
import { formatGbp, formatPenceAsPounds, parsePoundsToPence } from "./money.js";

describe("parsePoundsToPence", () => {
  it.each([
    ["25", 2500],
    ["25.5", 2550],
    ["25.50", 2550],
    ["£1,234.56", 123456],
    [" 0.01 ", 1],
    [".5", 50],
    ["12.", 1200],
  ])("reads %s as %i pence", (input, pence) => {
    expect(parsePoundsToPence(input)).toEqual({ ok: true, pence });
  });

  it("refuses more than two decimal places rather than rounding", () => {
    expect(parsePoundsToPence("1.005")).toEqual({ ok: false, reason: "too_precise" });
  });

  it.each(["", "  ", "abc", "1,23", "12.3.4", ".", "-5"])("refuses %j", (input) => {
    expect(parsePoundsToPence(input).ok).toBe(false);
  });
});

describe("formatting", () => {
  it("shows pounds with two decimals and grouping", () => {
    expect(formatPenceAsPounds(123456)).toBe("1,234.56");
    expect(formatGbp(5)).toBe("£0.05");
  });
});
