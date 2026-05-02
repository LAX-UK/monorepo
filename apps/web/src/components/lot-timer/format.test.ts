import { formatCountdownClock } from "@/lib/format-countdown";
import { describe, expect, it } from "vitest";
import { formatRemaining } from "./format";

describe("formatRemaining", () => {
  it("delegates to formatCountdownClock under 24 hours", () => {
    const ms = 90 * 60 * 1000 + 30_000;
    expect(formatRemaining(ms)).toBe(formatCountdownClock(ms));
  });

  it("prefixes whole days at or over 24 hours", () => {
    const ms = 25 * 60 * 60 * 1000;
    const remainder = ms % (24 * 60 * 60 * 1000);
    expect(formatRemaining(ms)).toBe(`1d ${formatCountdownClock(remainder)}`);
  });

  it("maps non-positive ms to zero clock", () => {
    expect(formatRemaining(0)).toBe("00:00:00");
    expect(formatRemaining(-1000)).toBe("00:00:00");
  });
});
