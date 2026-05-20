import { describe, expect, it } from "vitest";
import {
  dash,
  formatCount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
} from "./format";

describe("format", () => {
  it("formats money in USD", () => {
    expect(formatMoney(1234.5)).toMatch(/\$1,234\.50/);
  });

  it("formats money with currency", () => {
    expect(formatMoney(100, "GBP", "en-GB")).toMatch(/£100/);
  });

  it("formats dates", () => {
    const s = formatDate(new Date("2026-05-19T12:00:00Z"));
    expect(s).toContain("2026");
  });

  it("formats date time", () => {
    const s = formatDateTime(new Date("2026-05-19T14:30:00Z"));
    expect(s).not.toBe("—");
  });

  it("formats percent", () => {
    expect(formatPercent(12.5)).toContain("%");
  });

  it("formats count", () => {
    expect(formatCount(1200)).toBeTruthy();
  });

  it("dash returns em dash for empty values", () => {
    expect(dash(null)).toBe("—");
    expect(dash(undefined)).toBe("—");
    expect(dash("")).toBe("—");
    expect(dash("  ")).toBe("  ");
    expect(dash("ok")).toBe("ok");
  });
});
