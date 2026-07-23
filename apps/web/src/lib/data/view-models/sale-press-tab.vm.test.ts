import { describe, expect, it } from "vitest";
import { formatSalePressDate } from "./sale-press-tab.vm";

describe("formatSalePressDate", () => {
  it("formats ISO dates in en-GB short style", () => {
    expect(formatSalePressDate("2026-05-18")).toBe("18 May 2026");
  });

  it("returns null for empty values", () => {
    expect(formatSalePressDate(undefined)).toBeNull();
    expect(formatSalePressDate(null)).toBeNull();
    expect(formatSalePressDate("   ")).toBeNull();
  });
});
