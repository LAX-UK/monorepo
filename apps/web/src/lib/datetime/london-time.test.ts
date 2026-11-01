import { describe, expect, it } from "vitest";
import {
  formatLondonDate,
  formatLondonDateRange,
  formatLondonDateTime,
  formatLondonDayMonth,
  formatLondonMoment,
  formatLondonMonthYear,
  formatLondonTime,
  formatLondonTimeWithZone,
  formatLondonWeekday,
  londonDayKey,
  londonZoneName,
  toDate,
} from "./london-time";

const winter = new Date("2026-11-03T21:00:00Z");
const summer = new Date("2026-07-14T20:00:00Z");

describe("London time", () => {
  it("shows winter times in GMT and summer times in BST", () => {
    expect(formatLondonTimeWithZone(winter)).toBe("21:00 GMT");
    expect(formatLondonTimeWithZone(summer)).toBe("21:00 BST");
    expect(londonZoneName(summer)).toBe("BST");
  });

  it("uses the 24-hour clock with a leading zero", () => {
    expect(formatLondonTime(new Date("2026-11-03T09:05:00Z"))).toBe("09:05");
    expect(formatLondonTime(new Date("2026-11-03T00:00:00Z"))).toBe("00:00");
  });

  it("follows the clock change on the last Sunday of March and October", () => {
    expect(formatLondonTimeWithZone(new Date("2026-03-29T00:30:00Z"))).toBe("00:30 GMT");
    expect(formatLondonTimeWithZone(new Date("2026-03-29T01:30:00Z"))).toBe("02:30 BST");
    expect(formatLondonTimeWithZone(new Date("2026-10-25T00:30:00Z"))).toBe("01:30 BST");
    expect(formatLondonTimeWithZone(new Date("2026-10-25T01:30:00Z"))).toBe("01:30 GMT");
  });

  it("puts the day before the month", () => {
    expect(formatLondonDate(winter)).toBe("3 Nov 2026");
    expect(formatLondonDate(winter, { month: "long" })).toBe("3 November 2026");
    expect(formatLondonDateTime(winter)).toBe("3 Nov 2026, 21:00 GMT");
  });

  it("abbreviates September to three letters like every other month", () => {
    const september = new Date("2026-09-08T12:00:00Z");
    const now = new Date("2026-11-01T12:00:00Z");
    expect(formatLondonDate(september)).toBe("8 Sep 2026");
    expect(formatLondonDayMonth(september, now)).toBe("8 Sep");
    expect(formatLondonMonthYear(september, { short: true })).toBe("Sep 2026");
    expect(formatLondonDateRange(new Date("2026-08-23T12:00:00Z"), september)).toBe(
      "23 Aug – 8 Sep 2026",
    );
    expect(formatLondonMoment(september, now)).toBe("8 Sep 13:00");
    expect(formatLondonDate(september, { month: "long" })).toBe("8 September 2026");
  });

  it("reads the London day, not the server's", () => {
    // 23:30 UTC on 31 July is 00:30 on 1 August in London.
    const lateSummer = new Date("2026-07-31T23:30:00Z");
    expect(londonDayKey(lateSummer)).toBe("2026-08-01");
    expect(formatLondonDate(lateSummer)).toBe("1 Aug 2026");
  });

  it("shortens a date range as far as it stays clear", () => {
    expect(formatLondonDateRange(winter, winter)).toBe("3 Nov 2026");
    expect(
      formatLondonDateRange(new Date("2026-11-03T10:00:00Z"), new Date("2026-11-09T10:00:00Z")),
    ).toBe("3–9 Nov 2026");
    expect(formatLondonDateRange(new Date("2026-10-29T10:00:00Z"), winter)).toBe(
      "29 Oct – 3 Nov 2026",
    );
    expect(
      formatLondonDateRange(new Date("2026-12-29T10:00:00Z"), new Date("2027-01-03T10:00:00Z")),
    ).toBe("29 Dec 2026 – 3 Jan 2027");
  });

  it("names months and weekdays for calendar headings", () => {
    expect(formatLondonMonthYear(winter)).toBe("November 2026");
    expect(formatLondonMonthYear(winter, { short: true })).toBe("Nov 2026");
    expect(formatLondonWeekday(winter)).toBe("Tue");
  });

  it("drops the year when it is this year's", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    expect(formatLondonDayMonth(winter, now)).toBe("3 Nov");
    expect(formatLondonDayMonth(new Date("2027-01-03T10:00:00Z"), now)).toBe("3 Jan 2027");
  });

  it("says today, tomorrow and yesterday by the London calendar", () => {
    const now = new Date("2026-11-03T08:00:00Z");
    expect(formatLondonMoment(winter, now)).toBe("Today 21:00");
    expect(formatLondonMoment(new Date("2026-11-04T14:00:00Z"), now)).toBe("Tomorrow 14:00");
    expect(formatLondonMoment(new Date("2026-11-02T09:30:00Z"), now)).toBe("Yesterday 09:30");
    expect(formatLondonMoment(new Date("2026-11-19T14:00:00Z"), now)).toBe("19 Nov 14:00");
    expect(formatLondonMoment(new Date("2026-11-19T14:00:00Z"), now, { time: false })).toBe(
      "19 Nov",
    );
  });

  it("parses API values and refuses invalid ones", () => {
    expect(toDate("2026-11-03T21:00:00Z")?.getTime()).toBe(winter.getTime());
    expect(toDate(winter.getTime())?.getTime()).toBe(winter.getTime());
    expect(toDate("not a date")).toBeNull();
    expect(toDate(null)).toBeNull();
    expect(toDate("")).toBeNull();
  });
});
