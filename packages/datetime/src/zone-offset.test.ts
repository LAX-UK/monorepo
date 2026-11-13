import { tzOffset } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import { zoneOffsetMinutes } from "./zone-offset.js";

/** `zoneOffsetMinutes` replaced `tzOffset` from `@date-fns/tz`; it must answer exactly as it does. */
const zones = [
  ...Intl.supportedValuesOf("timeZone"),
  "UTC",
  "Etc/GMT+12",
  "Etc/GMT-14",
  "+05:30",
  "-08:00",
  "+0545",
  "-03",
  "Not/AZone",
  "",
];

const instants = [
  "1900-01-01T00:00:00Z",
  "1970-01-01T00:00:00Z",
  "2026-03-29T00:59:59Z",
  "2026-03-29T01:00:00Z",
  "2026-10-25T00:59:59Z",
  "2026-10-25T01:00:00Z",
  "2026-11-13T12:00:00Z",
  "2026-06-21T23:30:00Z",
  "2038-01-19T03:14:08Z",
].map((iso) => new Date(iso));

function same(a: number, b: number) {
  return Number.isNaN(a) ? Number.isNaN(b) : a === b;
}

describe("zoneOffsetMinutes", () => {
  it("matches tzOffset for every zone the runtime knows, across clock changes", () => {
    const differences: string[] = [];
    for (const zone of zones) {
      for (const instant of instants) {
        const expected = tzOffset(zone, instant);
        const actual = zoneOffsetMinutes(zone, instant);
        if (!same(actual, expected)) {
          differences.push(`${zone} ${instant.toISOString()}: ${actual} vs ${expected}`);
        }
      }
    }
    expect(differences).toEqual([]);
  });

  it("matches tzOffset hour by hour through a year in London, New York and Kathmandu", () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    for (const zone of ["Europe/London", "America/New_York", "Asia/Kathmandu"]) {
      for (let hour = 0; hour < 24 * 366; hour += 1) {
        const instant = new Date(start + hour * 3_600_000);
        expect(zoneOffsetMinutes(zone, instant)).toBe(tzOffset(zone, instant));
      }
    }
  });

  it("is NaN for an unknown zone, as tzOffset is", () => {
    expect(zoneOffsetMinutes("Not/AZone", new Date())).toBeNaN();
  });
});
