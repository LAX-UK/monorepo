import { describe, expect, it } from "vitest";
import { instantFromDatetimeFormString, toDatetimeFormString } from "./format.js";

describe("form strings in the sale's zone", () => {
  it.each([
    ["2026-03-08T04:00", "America/New_York", "2026-03-08T08:00:00.000Z"],
    ["2026-03-08T06:30", "America/New_York", "2026-03-08T10:30:00.000Z"],
    ["2026-09-27T09:00", "Pacific/Auckland", "2026-09-26T20:00:00.000Z"],
    ["2026-10-04T12:00", "Australia/Sydney", "2026-10-04T01:00:00.000Z"],
    ["2027-04-04T02:30", "Australia/Sydney", "2027-04-03T15:30:00.000Z"],
  ])("%s in %s is %s and reads back unchanged", (raw, zone, iso) => {
    const instant = instantFromDatetimeFormString(raw, zone);
    expect(instant.toISOString()).toBe(iso);
    expect(toDatetimeFormString(instant, zone)).toBe(raw);
  });

  it("moves a skipped time to the hour after the change", () => {
    expect(
      instantFromDatetimeFormString("2026-03-08T02:30", "America/New_York").toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");
  });
});
