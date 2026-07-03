import { describe, expect, it } from "vitest";
import {
  formatEventDateLondon,
  formatEventDateTimeLondon,
  formatEventDoorsTimeLondon,
} from "./event-date-format.js";

describe("event-date-format", () => {
  const startsAt = new Date("2026-06-18T18:00:00.000Z");

  it("formats London date labels", () => {
    expect(formatEventDateLondon(startsAt)).toContain("June");
    expect(formatEventDoorsTimeLondon(startsAt)).toMatch(/^Doors /);
  });

  it("combines date and time for hub cards", () => {
    const label = formatEventDateTimeLondon("2026-06-18T18:00:00.000Z");
    expect(label).toContain("June");
    expect(label).toContain("·");
  });

  it("returns null for invalid ISO values", () => {
    expect(formatEventDateTimeLondon(null)).toBeNull();
    expect(formatEventDateTimeLondon("not-a-date")).toBeNull();
  });
});
