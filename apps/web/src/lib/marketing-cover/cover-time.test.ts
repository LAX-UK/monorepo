import { describe, expect, it } from "vitest";
import { coverTimeLeft, coverTimeLine } from "./cover-time";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = new Date("2026-11-01T15:25:00Z");

describe("coverTimeLeft", () => {
  it("says nothing beyond 7 days or once over", () => {
    expect(coverTimeLeft(7 * DAY)).toBeNull();
    expect(coverTimeLeft(0)).toBeNull();
  });
  it("words days and hours within a week", () => {
    expect(coverTimeLeft(2 * DAY + 5 * HOUR + 10 * MIN)).toBe("2 days 5 hours");
    expect(coverTimeLeft(1 * DAY)).toBe("1 day");
  });
  it("words hours and minutes within a day", () => {
    expect(coverTimeLeft(5 * HOUR + 20 * MIN)).toBe("5 hours 20 minutes");
    expect(coverTimeLeft(2 * HOUR)).toBe("2 hours");
  });
  it("counts minutes and seconds in the final hour", () => {
    expect(coverTimeLeft(42 * MIN + 18_000)).toBe("42:18");
    expect(coverTimeLeft(9_000)).toBe("00:09");
  });
});

describe("coverTimeLine", () => {
  it("names a live sale's close and the time left", () => {
    const end = new Date(now.getTime() + 2 * DAY + 5 * HOUR);
    expect(coverTimeLine({ status: "active", start: null, end, now })).toBe(
      "Lots close from Tue 3 Nov, 20:25 GMT · 2 days 5 hours left",
    );
  });
  it("shows a date alone for a sale more than a week away", () => {
    const start = new Date("2026-11-10T21:00:00Z");
    expect(coverTimeLine({ status: "scheduled", start, end: null, now })).toBe(
      "Opens Tue 10 Nov, 21:00 GMT",
    );
  });
  it("adds the time until a sale within a week opens", () => {
    const start = new Date(now.getTime() + 3 * DAY);
    expect(coverTimeLine({ status: "scheduled", start, end: null, now })).toContain("· in 3 days");
  });
  it("says when a sale ended", () => {
    expect(
      coverTimeLine({ status: "ended", start: null, end: new Date("2026-10-15T20:00:00Z"), now }),
    ).toBe("Ended Thu 15 Oct");
    expect(
      coverTimeLine({ status: "ended", start: null, end: new Date("2026-11-01T14:00:00Z"), now }),
    ).toBe("Ended today, 14:00 GMT");
  });
  it("is null without the date it needs", () => {
    expect(coverTimeLine({ status: "active", start: null, end: null, now })).toBeNull();
  });
});
