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

describe("parsePoundsToPence, the cases every caller relies on", () => {
  it.each([
    ["1,200", { ok: true, pence: 120000 }],
    ["1,200.50", { ok: true, pence: 120050 }],
    ["£1,200", { ok: true, pence: 120000 }],
    ["1.2", { ok: true, pence: 120 }],
    ["0.005", { ok: false, reason: "too_precise" }],
    ["", { ok: false, reason: "empty" }],
    ["-1", { ok: false, reason: "invalid" }],
    ["abc", { ok: false, reason: "invalid" }],
  ])("reads %j", (input, expected) => {
    expect(parsePoundsToPence(input)).toEqual(expected);
  });
});

describe("formatting", () => {
  it("shows pounds with two decimals and grouping", () => {
    expect(formatPenceAsPounds(123456)).toBe("1,234.56");
    expect(formatGbp(5)).toBe("£0.05");
  });
});
