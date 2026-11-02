import { describe, expect, it } from "vitest";
import { opensBadgeLabel, opensLine } from "./opens-line";

const now = new Date("2026-11-01T12:00:00Z");
const at = (ms: number) => new Date(now.getTime() + ms);
const H = 3_600_000;
const D = 24 * H;

describe("opensLine", () => {
  it("tells a date beyond a week", () => {
    expect(opensLine(new Date("2026-11-27T20:19:00Z"), now)).toEqual({
      label: "Opens",
      value: "27 Nov 2026, 20:19 GMT",
    });
  });

  it("counts days and hours within a week", () => {
    expect(opensLine(at(2 * D + 14 * H + 5 * 60_000), now)).toEqual({
      label: "Opens in",
      value: "2 days 14 hours",
    });
    expect(opensLine(at(7 * D), now).label).toBe("Opens in");
  });

  it("counts hours and minutes within a day", () => {
    expect(opensLine(at(5 * H + 12 * 60_000), now).value).toBe("5 hours 12 minutes");
    expect(opensLine(at(H + 60_000), now).value).toBe("1 hour 1 minute");
  });

  it("counts minutes and seconds in the final hour", () => {
    expect(opensLine(at(42 * 60_000 + 10_000), now).value).toBe("42 minutes 10 seconds");
    expect(opensLine(at(20_000), now).value).toBe("20 seconds");
  });

  it("switches from date to countdown at exactly seven days", () => {
    expect(opensLine(at(7 * D + 1), now).label).toBe("Opens");
    expect(opensLine(at(7 * D), now)).toEqual({ label: "Opens in", value: "7 days" });
  });

  it("takes another prefix", () => {
    expect(opensLine(at(D), now, "Preview opens").label).toBe("Preview opens in");
  });

  it("says now once it has opened", () => {
    expect(opensLine(at(-1), now)).toEqual({ label: "Opens", value: "now" });
  });
});

describe("opensBadgeLabel", () => {
  it("names the weekday and day", () => {
    expect(opensBadgeLabel(new Date("2026-11-10T10:00:00Z"), now)).toBe("Opens Tue 10 Nov");
  });
  it("adds the year when it is not this year", () => {
    expect(opensBadgeLabel(new Date("2027-02-22T10:00:00Z"), now)).toBe("Opens Mon 22 Feb 2027");
  });
});
