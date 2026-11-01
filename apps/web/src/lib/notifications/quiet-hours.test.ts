import { describe, expect, it } from "vitest";
import { QUIET_HOUR_OPTIONS, quietHoursZoneLabel } from "./quiet-hours";

describe("quiet hours", () => {
  it("offers every half hour in 24-hour time", () => {
    expect(QUIET_HOUR_OPTIONS).toHaveLength(48);
    expect(QUIET_HOUR_OPTIONS[0]).toBe("00:00");
    expect(QUIET_HOUR_OPTIONS[45]).toBe("22:30");
  });

  it("names the person's zone, with the clock it is on", () => {
    expect(quietHoursZoneLabel("Europe/London", new Date("2026-12-01T12:00:00Z"))).toBe(
      "London time (GMT)",
    );
    expect(quietHoursZoneLabel("Europe/London", new Date("2026-07-01T12:00:00Z"))).toBe(
      "London time (BST)",
    );
    expect(quietHoursZoneLabel("America/New_York", new Date("2026-12-01T12:00:00Z"))).toBe(
      "New York time (GMT-5)",
    );
  });
});
