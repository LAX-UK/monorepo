import { describe, expect, it } from "vitest";
import { lastActiveDay } from "./member-last-active.js";

describe("lastActiveDay", () => {
  it("gives the calendar day only", () => {
    expect(lastActiveDay(new Date("2026-10-28T14:37:12Z"))).toBe("2026-10-28");
  });

  it("counts the day in London, so a late sign-in in summer time is the next day", () => {
    expect(lastActiveDay(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(lastActiveDay(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });

  it("is unknown without a time, or with an invalid one", () => {
    expect(lastActiveDay(null)).toBeNull();
    expect(lastActiveDay(undefined)).toBeNull();
    expect(lastActiveDay(new Date("nope"))).toBeNull();
  });
});
