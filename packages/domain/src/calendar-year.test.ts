import { describe, expect, it } from "vitest";
import { londonCalendarYear } from "./calendar-year.js";

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
