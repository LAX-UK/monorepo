import { describe, expect, it } from "vitest";
import {
  londonCalendarYear,
  londonMidnight,
  londonOffsetMinutes,
  londonWallClock,
} from "./calendar-year.js";
import { formatCollectionWhen, londonZoneLabel } from "./collection-time.js";
import { lastActiveDay } from "./member-last-active.js";
import { isWithinQuietHours, localMinuteOfDay } from "./quiet-hours.js";
import { localDateOf, zonedInstant } from "./working-hours.js";

// UK clocks went forward at 01:00 UTC on 29 March 2026 and back at 01:00 UTC on 25 October 2026.
describe("London helpers on the days the clocks change", () => {
  it("reads the offset either side of each change", () => {
    expect(londonOffsetMinutes(new Date("2026-03-29T00:59:00Z"))).toBe(0);
    expect(londonOffsetMinutes(new Date("2026-03-29T01:00:00Z"))).toBe(60);
    expect(londonOffsetMinutes(new Date("2026-10-25T00:59:00Z"))).toBe(60);
    expect(londonOffsetMinutes(new Date("2026-10-25T01:00:00Z"))).toBe(0);
  });

  it("finds London midnight in winter and summer", () => {
    expect(londonMidnight(2026, 1, 1).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(londonMidnight(2026, 7, 1).toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(londonMidnight(2026, 3, 29).toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(londonMidnight(2026, 10, 25).toISOString()).toBe("2026-10-24T23:00:00.000Z");
  });

  it("rolls a day past the month end into the next month", () => {
    expect(londonMidnight(2026, 1, 32).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("puts 09:00 on London's clock on the right instant", () => {
    expect(londonWallClock(2026, 3, 29, 9).toISOString()).toBe("2026-03-29T08:00:00.000Z");
    expect(londonWallClock(2026, 10, 25, 9).toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });

  it("bounds the London year by midnight on 1 January", () => {
    const { year, from, to } = londonCalendarYear(new Date("2026-12-31T23:30:00Z"));
    expect(year).toBe(2026);
    expect(from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(londonCalendarYear(new Date("2026-06-30T23:30:00Z")).year).toBe(2026);
  });

  it("counts a summer-time evening on the next London day", () => {
    expect(lastActiveDay(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    expect(lastActiveDay(new Date("2026-12-30T23:30:00Z"))).toBe("2026-12-30");
    expect(localDateOf(new Date("2026-06-30T23:30:00Z"), "Europe/London")).toEqual({
      year: 2026,
      month: 7,
      day: 1,
    });
  });

  it("labels the zone GMT or BST", () => {
    expect(londonZoneLabel(new Date("2026-03-29T00:59:00Z"))).toBe("GMT");
    expect(londonZoneLabel(new Date("2026-03-29T01:00:00Z"))).toBe("BST");
    expect(
      formatCollectionWhen(new Date("2026-10-25T13:00:00Z"), new Date("2026-10-01T00:00:00Z")),
    ).toBe("Sun 25 Oct, 13:00 GMT");
  });

  it("builds an instant from a local minute, moving a skipped time past the gap", () => {
    const day = { year: 2026, month: 3, day: 29 };
    expect(zonedInstant(day, 9 * 60, "Europe/London").toISOString()).toBe(
      "2026-03-29T08:00:00.000Z",
    );
    expect(zonedInstant(day, 60 + 30, "Europe/London").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
    expect(
      zonedInstant({ year: 2026, month: 10, day: 25 }, 90, "Europe/London").toISOString(),
    ).toBe("2026-10-25T00:30:00.000Z");
  });

  it("reads quiet hours on the local clock through a change", () => {
    expect(localMinuteOfDay(new Date("2026-10-25T00:30:00Z"), "Europe/London")).toBe(90);
    expect(localMinuteOfDay(new Date("2026-10-25T01:30:00Z"), "Europe/London")).toBe(90);
    const quiet = { start: "22:00", end: "07:00", timeZone: "Europe/London" };
    expect(isWithinQuietHours(quiet, new Date("2026-07-01T05:30:00Z"))).toBe(true);
    expect(isWithinQuietHours(quiet, new Date("2026-07-01T06:30:00Z"))).toBe(false);
    expect(
      isWithinQuietHours({ ...quiet, timeZone: "Not/AZone" }, new Date("2026-07-01T05:30:00Z")),
    ).toBe(true);
  });
});
