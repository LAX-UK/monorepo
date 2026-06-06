import { describe, expect, it } from "vitest";
import {
  breakdownCountdown,
  parseCountdownTarget,
  resolveCountdownTarget,
} from "./event-countdown.js";

describe("parseCountdownTarget", () => {
  it("parses valid ISO timestamps", () => {
    const date = parseCountdownTarget("2026-06-18T18:00:00.000Z");
    expect(date?.toISOString()).toBe("2026-06-18T18:00:00.000Z");
  });

  it("returns null for invalid values", () => {
    expect(parseCountdownTarget(null)).toBeNull();
    expect(parseCountdownTarget("")).toBeNull();
    expect(parseCountdownTarget("not-a-date")).toBeNull();
  });
});

describe("resolveCountdownTarget", () => {
  it("falls back to bundled doors-open time when API value is missing", () => {
    expect(resolveCountdownTarget(null).toISOString()).toBe("2026-06-18T17:00:00.000Z");
  });
});

describe("breakdownCountdown", () => {
  it("splits remaining time into days, hours, and minutes", () => {
    const remainingMs = ((2 * 24 + 3) * 60 + 14) * 60_000;
    expect(breakdownCountdown(remainingMs)).toEqual({
      days: 2,
      hours: 3,
      minutes: 14,
      remainingMs,
    });
  });

  it("returns zeros when the event has started", () => {
    expect(breakdownCountdown(0)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      remainingMs: 0,
    });
  });
});
