import { describe, expect, it } from "vitest";
import {
  QUIET_HOUR_OPTIONS,
  quietHoursZoneLabel,
  quietTimeToLocal,
  quietTimeToUtc,
} from "./quiet-hours";

const SUMMER = new Date("2026-07-01T12:00:00Z");
const WINTER = new Date("2026-12-01T12:00:00Z");

describe("quiet hours", () => {
  it("shows stored UTC times in London time, summer and winter", () => {
    expect(quietTimeToLocal("21:00", "Europe/London", SUMMER)).toBe("22:00");
    expect(quietTimeToLocal("21:00", "Europe/London", WINTER)).toBe("21:00");
    expect(quietTimeToLocal("23:30", "Europe/London", SUMMER)).toBe("00:30");
  });

  it("stores London times as UTC, and empty as empty", () => {
    expect(quietTimeToUtc("07:00", "Europe/London", SUMMER)).toBe("06:00");
    expect(quietTimeToUtc("00:30", "Europe/London", SUMMER)).toBe("23:30");
    expect(quietTimeToUtc("", "Europe/London", SUMMER)).toBe("");
  });

  it("offers every half hour in 24-hour time and names the zone", () => {
    expect(QUIET_HOUR_OPTIONS).toHaveLength(48);
    expect(QUIET_HOUR_OPTIONS[45]).toBe("22:30");
    expect(quietHoursZoneLabel("Europe/London", WINTER)).toBe("London time (GMT)");
    expect(quietHoursZoneLabel("Europe/London", SUMMER)).toBe("London time (BST)");
  });
});
