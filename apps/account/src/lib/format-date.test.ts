import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatRelativeAge,
  formatTime,
  isSameLondonDay,
} from "./format-date";

describe("formatDate", () => {
  it("leads with the weekday and always shows the year", () => {
    expect(formatDate("2026-09-29T10:00:00.000Z")).toBe("Tue 29 Sep 2026");
  });

  it("writes September as Sep, never Sept", () => {
    expect(formatDate("2026-09-01T12:00:00.000Z")).toBe("Tue 1 Sep 2026");
  });

  it("reads the London day: late evening UTC in summer is already tomorrow", () => {
    expect(formatDate("2026-07-01T23:30:00.000Z")).toBe("Thu 2 Jul 2026");
    expect(formatDate("2026-03-01T23:30:00.000Z")).toBe("Sun 1 Mar 2026");
  });

  it("returns the input unchanged when it is not a date", () => {
    expect(formatDate("not a date")).toBe("not a date");
  });
});

describe("formatTime", () => {
  it("shows GMT in winter and BST in summer", () => {
    expect(formatTime("2026-11-12T04:49:00.000Z")).toBe("04:49 GMT");
    expect(formatTime("2026-07-12T04:49:00.000Z")).toBe("05:49 BST");
  });

  it("switches at the clocks change", () => {
    expect(formatTime("2026-03-29T00:59:00.000Z")).toBe("00:59 GMT");
    expect(formatTime("2026-03-29T01:00:00.000Z")).toBe("02:00 BST");
    expect(formatTime("2026-10-25T00:59:00.000Z")).toBe("01:59 BST");
    expect(formatTime("2026-10-25T01:00:00.000Z")).toBe("01:00 GMT");
  });

  it("writes midnight as 00:00", () => {
    expect(formatTime("2026-11-12T00:00:00.000Z")).toBe("00:00 GMT");
  });
});

describe("formatDateTime", () => {
  const now = new Date("2026-11-06T09:00:00.000Z");

  it("reads in the family style in winter", () => {
    expect(formatDateTime("2026-11-12T04:49:00.000Z", now)).toBe("Thu 12 Nov, 04:49 GMT");
  });

  it("uses BST in summer", () => {
    expect(formatDateTime("2026-07-14T10:30:00.000Z", now)).toBe("Tue 14 Jul, 11:30 BST");
  });

  it("adds the year beyond the current year, in either direction", () => {
    expect(formatDateTime("2027-02-04T08:00:00.000Z", now)).toBe("Thu 4 Feb 2027, 08:00 GMT");
    expect(formatDateTime("2025-12-31T08:00:00.000Z", now)).toBe("Wed 31 Dec 2025, 08:00 GMT");
  });

  it("judges the year in London time", () => {
    expect(formatDateTime("2026-12-31T23:30:00.000Z", "2026-12-31T23:40:00.000Z")).toBe(
      "Thu 31 Dec, 23:30 GMT",
    );
    expect(formatDateTime("2026-12-31T23:30:00.000Z", "2027-01-01T00:30:00.000Z")).toBe(
      "Thu 31 Dec 2026, 23:30 GMT",
    );
  });
});

describe("isSameLondonDay", () => {
  it("compares London calendar days", () => {
    expect(isSameLondonDay("2026-07-01T22:30:00.000Z", "2026-07-01T23:30:00.000Z")).toBe(false);
    expect(isSameLondonDay("2026-11-01T01:00:00.000Z", "2026-11-01T23:30:00.000Z")).toBe(true);
  });
});

describe("formatRelativeAge", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it.each([
    [10_000, "just now"],
    [MINUTE, "1 minute ago"],
    [45 * MINUTE, "45 minutes ago"],
    [HOUR, "1 hour ago"],
    [5 * HOUR, "5 hours ago"],
    [DAY, "1 day ago"],
    [12 * DAY, "12 days ago"],
    [60 * DAY, "on Mon 24 Aug 2026"],
  ])("%i ms ago reads %s", (elapsed, text) => {
    expect(formatRelativeAge(new Date(now.getTime() - elapsed), now)).toBe(text);
  });

  it("never reads as the future when clocks disagree", () => {
    expect(formatRelativeAge(new Date(now.getTime() + HOUR), now)).toBe("just now");
  });
});
