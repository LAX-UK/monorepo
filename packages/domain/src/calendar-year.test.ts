import { describe, expect, it } from "vitest";
import { londonCalendarYear, londonWallClock } from "./calendar-year.js";

describe("londonCalendarYear", () => {
  it("runs from midnight on 1 January to midnight on the next 1 January, UK time", () => {
    const year = londonCalendarYear(new Date("2026-07-15T12:00:00Z"));
    expect(year.year).toBe(2026);
    expect(year.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(year.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("puts the last second of the year in that year and the first of the next in the next", () => {
    expect(londonCalendarYear(new Date("2026-12-31T23:59:59Z")).year).toBe(2026);
    expect(londonCalendarYear(new Date("2027-01-01T00:00:00Z")).year).toBe(2027);
  });

  it("counts by London's calendar while summer time is on", () => {
    // 23:30 UTC on 30 June is already 1 July in London, but the year is the same.
    expect(londonCalendarYear(new Date("2026-06-30T23:30:00Z")).year).toBe(2026);
  });
});

describe("londonWallClock", () => {
  const nine = (y: number, m: number, d: number) => londonWallClock(y, m, d, 9).toISOString();

  it("is 09:00 UTC in winter and 08:00 UTC in summer", () => {
    expect(nine(2026, 12, 10)).toBe("2026-12-10T09:00:00.000Z");
    expect(nine(2026, 7, 10)).toBe("2026-07-10T08:00:00.000Z");
  });

  it("stays at 09:00 London on both 2026 clock-change Sundays", () => {
    expect(nine(2026, 3, 29)).toBe("2026-03-29T08:00:00.000Z");
    expect(nine(2026, 10, 25)).toBe("2026-10-25T09:00:00.000Z");
  });

  it("rolls days past the month end over", () => {
    expect(nine(2026, 3, 32)).toBe("2026-04-01T08:00:00.000Z");
  });
});
