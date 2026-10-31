import { describe, expect, it } from "vitest";
import { QuietHoursChecker } from "./quiet-hours.checker.js";

describe("QuietHoursChecker", () => {
  it("reads quiet hours in the person's zone at the current moment", () => {
    const summerNight = new QuietHoursChecker(() => new Date("2026-07-01T21:30:00Z"));
    expect(
      summerNight.isQuietTime({ start: "22:00", end: "07:00", timeZone: "Europe/London" }),
    ).toBe(true);
    expect(summerNight.isQuietTime({ start: "22:00", end: "07:00", timeZone: "UTC" })).toBe(false);
    expect(summerNight.isQuietTime({ start: null, end: null, timeZone: "Europe/London" })).toBe(
      false,
    );
  });
});
