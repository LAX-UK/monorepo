import { describe, expect, it } from "vitest";
import { inboxFullTime, inboxTime } from "./inbox-time";
import { dateBand } from "./notification-presenters";

const NOW = new Date("2026-10-31T16:00:00Z");

describe("inboxTime", () => {
  it("shows the time today and yesterday, where the day heading names the day", () => {
    expect(inboxTime(new Date("2026-10-31T14:02:00Z"), NOW)).toBe("14:02");
    expect(inboxTime(new Date("2026-10-30T09:05:00Z"), NOW)).toBe("09:05");
  });

  it("shows the date for anything older", () => {
    expect(inboxTime(new Date("2026-10-29T09:00:00Z"), NOW)).toBe("29 Oct");
  });

  it("reads London time in summer, whatever zone the runtime is in", () => {
    const summerNow = new Date("2026-07-14T20:00:00Z");
    expect(inboxTime(new Date("2026-07-14T13:02:00Z"), summerNow)).toBe("14:02");
  });

  it("gives the full date and time for the tooltip", () => {
    expect(inboxFullTime(new Date("2026-10-31T14:02:00Z"))).toBe("Saturday 31 October 2026, 14:02");
  });
});

describe("dateBand across the London midnight", () => {
  it("splits days at London midnight, not UTC midnight", () => {
    const now = new Date("2026-07-15T09:00:00Z");
    expect(dateBand(new Date("2026-07-14T23:30:00Z"), now)).toBe("Today");
    expect(dateBand(new Date("2026-07-14T22:30:00Z"), now)).toBe("Yesterday");
  });

  it("bands older days", () => {
    expect(dateBand(new Date("2026-10-26T12:00:00Z"), NOW)).toBe("This week");
    expect(dateBand(new Date("2026-10-01T12:00:00Z"), NOW)).toBe("Earlier");
    expect(dateBand("not a date", NOW)).toBe("Earlier");
  });
});
