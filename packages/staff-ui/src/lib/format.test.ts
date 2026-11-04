import { describe, expect, it } from "vitest";
import {
  formatStaffDate,
  formatStaffDateTime,
  formatStaffMoney,
  formatStaffRelative,
  formatStaffTime,
  formatStaffWhen,
  londonZoneLabel,
  staffShortDateFormat,
} from "./format.js";

describe("staff date and time formatters", () => {
  it("writes dates in full, never as digits that read two ways", () => {
    expect(formatStaffDate("2026-10-24T13:05:00Z")).toBe("24 Oct 2026");
  });

  it("writes September as Sep so every month is three letters", () => {
    expect(formatStaffDate("2026-09-30T12:00:00Z")).toBe("30 Sep 2026");
    expect(formatStaffDateTime("2026-09-30T12:00:00Z")).toBe("30 Sep 2026, 13:00");
    expect(
      staffShortDateFormat({ day: "numeric", month: "short" }).format(
        new Date("2026-09-03T12:00:00Z"),
      ),
    ).toBe("3 Sep");
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

  it("writes the one date style: weekday, day and month, 24-hour time and zone", () => {
    const now = "2026-11-04T12:00:00Z";
    expect(formatStaffWhen("2026-11-12T04:49:00Z", now)).toBe("Thu 12 Nov, 04:49 GMT");
    expect(formatStaffWhen("2026-07-14T13:05:00Z", now)).toBe("Tue 14 Jul, 14:05 BST");
    expect(formatStaffWhen("2026-09-30T12:00:00Z", now)).toBe("Wed 30 Sep, 13:00 BST");
  });

  it("adds the year only when it is not this year's", () => {
    expect(formatStaffWhen("2025-12-31T23:30:00Z", "2026-11-04T12:00:00Z")).toBe(
      "Wed 31 Dec 2025, 23:30 GMT",
    );
    expect(formatStaffWhen("2026-12-31T23:30:00Z", "2026-11-04T12:00:00Z")).toBe(
      "Thu 31 Dec, 23:30 GMT",
    );
  });

  it("reads the day in London, not UTC, across midnight", () => {
    expect(formatStaffWhen("2026-07-14T23:30:00Z", "2026-07-14T12:00:00Z")).toBe(
      "Wed 15 Jul, 00:30 BST",
    );
  });

  it("returns unreadable input unchanged rather than inventing a date", () => {
    expect(formatStaffWhen("not a date")).toBe("not a date");
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
