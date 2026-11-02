import { describe, expect, it } from "vitest";
import {
  countdownTier,
  formatCountdownAnnounce,
  formatCountdownAriaLabel,
  formatCountdownForDisplay,
  formatCountdownShort,
  parseCountdownSegments,
} from "./format-countdown";

describe("formatCountdownShort", () => {
  it("shows the two largest units, down to seconds", () => {
    expect(formatCountdownShort(2 * 86_400_000 + 3 * 3_600_000 + 5 * 60_000)).toBe("2d 3h");
    expect(formatCountdownShort(72 * 60_000 + 30_000)).toBe("1h 12m");
    expect(formatCountdownShort(4 * 60_000 + 12_000)).toBe("4m 12s");
    expect(formatCountdownShort(45_000)).toBe("45s");
    expect(formatCountdownShort(-1)).toBe("0s");
  });
});

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

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

describe("formatCountdownForDisplay: the time rule", () => {
  it.each([
    ["a week and a bit", 7 * D + H, "7 days 1 hour"],
    ["exactly seven days", 7 * D, "7 days"],
    ["inside a week", 2 * D + 14 * H + 5 * M, "2 days 14 hours"],
    ["one day exactly", D, "1 day"],
    ["a second under a day", D - S, "23 hours 59 minutes"],
    ["hours and minutes", 5 * H + 12 * M + 40 * S, "5 hours 12 minutes"],
    ["one hour exactly, no seconds", H, "1 hour"],
    ["a second over the final hour", H + S, "1 hour"],
    ["a second under the final hour", H - S, "59 minutes 59 seconds"],
    ["minutes and seconds in the final hour", 42 * M + 10 * S, "42 minutes 10 seconds"],
    ["one minute exactly", M, "1 minute"],
    ["under a minute", 45 * S, "45 seconds"],
    ["the last second", S, "1 second"],
    ["zero", 0, "0 seconds"],
    ["negative", -5 * S, "0 seconds"],
  ])("%s", (_name, ms, expected) => {
    expect(formatCountdownForDisplay(ms)).toBe(expected);
  });
});

describe("formatCountdownAnnounce", () => {
  it.each([
    [2 * D + 3 * H, "2 days 3 hours"],
    [5 * H + 12 * M, "5 hours 12 minutes"],
    [H - S, "59 minutes"],
    [45 * S, "1 minute"],
  ])("%d ms reads %s, never seconds", (ms, expected) => {
    expect(formatCountdownAnnounce(ms)).toBe(expected);
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
