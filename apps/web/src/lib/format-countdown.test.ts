import { describe, expect, it } from "vitest";
import {
  countdownTier,
  formatCountdownAriaLabel,
  formatCountdownForDisplay,
  parseCountdownSegments,
} from "./format-countdown";

describe("countdownTier", () => {
  it("is critical under 10 minutes", () => {
    expect(countdownTier(9 * 60 * 1000)).toBe("critical");
  });
  it("is urgent under 1 hour but not under 10m rule", () => {
    expect(countdownTier(30 * 60 * 1000)).toBe("urgent");
  });
  it("is normal at 2 hours", () => {
    expect(countdownTier(2 * 60 * 60 * 1000)).toBe("normal");
  });
});

describe("formatCountdownAriaLabel", () => {
  it("describes multi-day windows", () => {
    const label = formatCountdownAriaLabel(2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000);
    expect(label).toContain("Closes in");
    expect(label).toMatch(/day/);
  });
});

describe("formatCountdownForDisplay", () => {
  it("still formats under 24h as clock", () => {
    expect(formatCountdownForDisplay(90 * 60 * 1000 + 30_000)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe("parseCountdownSegments", () => {
  it("splits multi-day remaining time", () => {
    const ms = 2 * 86_400_000 + 3 * 3_600_000 + 45 * 60_000 + 30_000;
    expect(parseCountdownSegments(ms)).toEqual({ days: 2, hours: 3, minutes: 45, seconds: 30 });
  });

  it("splits sub-day remaining time with zero days", () => {
    expect(parseCountdownSegments(90 * 60_000 + 30_000)).toEqual({
      days: 0,
      hours: 1,
      minutes: 30,
      seconds: 30,
    });
  });

  it("clamps negative input to zero segments", () => {
    expect(parseCountdownSegments(-1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
