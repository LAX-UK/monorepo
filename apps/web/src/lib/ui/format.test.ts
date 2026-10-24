import { describe, expect, it } from "vitest";
import {
  dash,
  formatCount,
  formatDate,
  formatDateShort,
  formatDateTime,
  formatDateTimeShort,
  formatKpiMoney,
  formatMoney,
  formatPercent,
  formatPeriod,
} from "./format";

describe("format", () => {
  it("formats money in GBP by default", () => {
    expect(formatMoney(1234.5)).toMatch(/£1,234\.50/);
  });

  it("formats money with currency", () => {
    expect(formatMoney(100, "USD", "en-GB")).toMatch(/\$100/);
  });

  it("formats dates", () => {
    const s = formatDate(new Date("2026-05-19T12:00:00Z"));
    expect(s).toContain("2026");
  });

  it("formats short dates with 2-digit year", () => {
    const s = formatDateShort(new Date("2026-05-19T12:00:00Z"));
    expect(s).toMatch(/19 May 26/);
    expect(s).not.toContain("2026");
  });

  it("formats short date time with 2-digit year when reference year differs", () => {
    const s = formatDateTimeShort(
      new Date("2025-05-19T14:30:00Z"),
      new Date("2026-05-18T12:00:00Z"),
    );
    expect(s).toMatch(/19 May 25/);
    expect(s).not.toContain("2025");
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

describe("formatKpiMoney", () => {
  it("shows whole pounds below 100k, compact above, and zero as £0", () => {
    expect(formatKpiMoney(0)).toBe("£0");
    expect(formatKpiMoney("83750.00")).toBe("£83,750");
    expect(formatKpiMoney(1_234_567)).toBe("£1.2m");
    expect(formatKpiMoney(null)).toBe("—");
    expect(formatKpiMoney("abc")).toBe("—");
  });
});

describe("formatPeriod", () => {
  it("joins two dates with an arrow", () => {
    expect(formatPeriod("2026-01-01T00:00:00Z", "2026-06-22T00:00:00Z")).toBe(
      "1 Jan 2026 → 22 Jun 2026",
    );
  });

  it("reads an epoch or missing start as an open-ended period", () => {
    expect(formatPeriod(new Date(0), "2026-06-22T00:00:00Z")).toBe("Up to 22 Jun 2026");
    expect(formatPeriod("1970-01-01T00:00:00.000Z", "2026-06-22T00:00:00Z")).toBe(
      "Up to 22 Jun 2026",
    );
    expect(formatPeriod(null, "2026-06-22T00:00:00Z")).toBe("Up to 22 Jun 2026");
    expect(formatPeriod(null, null)).toBe("—");
  });
});
