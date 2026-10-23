import { describe, expect, it } from "vitest";
import { parseGapDate, toGapDate } from "./gap-date.js";
import { toWindowsTimezoneId } from "./windows-timezone.js";

describe("parseGapDate", () => {
  it.each([
    ["/Date(1792072800000-0000)/", 1792072800000],
    ["/Date(1792072800000+0100)/", 1792072800000],
    ["/Date(1792072800000)/", 1792072800000],
    ["/Date(-1000)/", -1000],
    ["2026-10-13T12:00:00Z", Date.UTC(2026, 9, 13, 12)],
  ])("parses %s", (input, epochMs) => {
    expect(parseGapDate(input)?.getTime()).toBe(epochMs);
  });

  it.each([null, undefined, "", "   ", "not a date"])("returns null for %j", (input) => {
    expect(parseGapDate(input)).toBeNull();
  });

  it("formats outbound dates as ISO UTC", () => {
    expect(toGapDate(new Date(Date.UTC(2026, 9, 13, 12)))).toBe("2026-10-13T12:00:00.000Z");
  });
});

describe("toWindowsTimezoneId", () => {
  it("maps Europe/London to GMT Standard Time", () => {
    expect(toWindowsTimezoneId("Europe/London")).toBe("GMT Standard Time");
  });

  it("throws for unmapped zones instead of guessing", () => {
    expect(() => toWindowsTimezoneId("Mars/Olympus")).toThrow(/No Windows timezone mapping/);
  });
});
