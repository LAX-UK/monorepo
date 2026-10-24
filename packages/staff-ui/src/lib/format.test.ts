import { describe, expect, it } from "vitest";
import {
  formatStaffDate,
  formatStaffDateTime,
  formatStaffMoney,
  formatStaffRelative,
  formatStaffTime,
  londonZoneLabel,
} from "./format.js";

describe("staff date and time formatters", () => {
  it("writes dates in full, never as digits that read two ways", () => {
    expect(formatStaffDate("2026-10-24T13:05:00Z")).toBe("24 Oct 2026");
  });

  it("shows London time on a 24-hour clock, whatever the zone of the input", () => {
    expect(formatStaffTime("2026-10-24T13:05:00Z")).toBe("14:05");
    expect(formatStaffTime("2026-12-01T21:30:00Z")).toBe("21:30");
  });

  it("labels British Summer Time and Greenwich Mean Time", () => {
    expect(londonZoneLabel("2026-10-24T13:05:00Z")).toBe("BST");
    expect(londonZoneLabel("2026-10-25T13:05:00Z")).toBe("GMT");
    expect(formatStaffDateTime("2026-10-24T13:05:00Z", { zoneLabel: true })).toBe(
      "24 Oct 2026, 14:05 BST",
    );
    expect(formatStaffDateTime("2026-11-02T09:00:00Z", { zoneLabel: true })).toBe(
      "2 Nov 2026, 09:00 GMT",
    );
  });

  it("keeps the old date-time shape without a zone label", () => {
    expect(formatStaffDateTime("2026-10-24T13:05:00Z")).toBe("24 Oct 2026, 14:05");
  });

  it("returns unreadable input unchanged rather than inventing a date", () => {
    expect(formatStaffDate("not a date")).toBe("not a date");
    expect(formatStaffDateTime("")).toBe("");
  });

  it("says how long ago, for activity", () => {
    const now = "2026-10-24T13:05:00Z";
    expect(formatStaffRelative("2026-10-24T13:04:50Z", now)).toBe("just now");
    expect(formatStaffRelative("2026-10-24T13:02:00Z", now)).toBe("3 minutes ago");
    expect(formatStaffRelative("2026-10-23T13:05:00Z", now)).toBe("yesterday");
  });
});

describe("formatStaffMoney", () => {
  it("shows pounds with the symbol and two decimals", () => {
    expect(formatStaffMoney(125000)).toBe("£1,250.00");
    expect(formatStaffMoney(5)).toBe("£0.05");
  });

  it("uses a true minus sign for refunds and other negatives", () => {
    expect(formatStaffMoney(-2000)).toBe("−£20.00");
  });

  it("adds the ISO code after any other currency", () => {
    expect(formatStaffMoney(125000, "eur")).toBe("€1,250.00 EUR");
    expect(formatStaffMoney(-99, "USD")).toBe("−US$0.99 USD");
  });
});
