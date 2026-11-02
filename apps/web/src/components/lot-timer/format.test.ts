import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { describe, expect, it } from "vitest";
import { formatRemaining, timerText } from "./format";

const NOW = Date.parse("2026-11-02T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("formatRemaining", () => {
  it("is the shared countdown formatter", () => {
    expect(formatRemaining).toBe(formatCountdownForDisplay);
  });
});

describe("timerText: the time rule at each boundary", () => {
  it("counts a week exactly, with the compact form beside it", () => {
    expect(timerText(7 * DAY, NOW)).toEqual({ words: "7 days", compact: "7d 0h", date: null });
  });

  it("tells a date a moment past a week", () => {
    expect(timerText(7 * DAY + 1, NOW)).toEqual({
      words: "",
      compact: "Mon 9 Nov",
      date: "Mon 9 Nov",
    });
  });

  it("gives days and hours, hours and minutes", () => {
    expect(timerText(2 * DAY + 14 * HOUR, NOW).words).toBe("2 days 14 hours");
    expect(timerText(5 * HOUR + 12 * 60_000, NOW).compact).toBe("5h 12m");
  });

  it("gives seconds and a clock through the final hour", () => {
    expect(timerText(HOUR, NOW)).toMatchObject({ words: "1 hour", compact: "1h 0m" });
    expect(timerText(42 * 60_000 + 9_000, NOW)).toEqual({
      words: "42 minutes 9 seconds",
      compact: "42:09",
      date: null,
    });
    expect(timerText(45_000, NOW).compact).toBe("00:45");
  });
});
