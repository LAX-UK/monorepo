import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { LONDON_TIME_ZONE } from "./constants.js";
import { addCalendarDays } from "./day-zoned.js";
import { dayKey } from "./day.js";
import { shortMonthFormat } from "./zone-formats.js";

const ZONES = [LONDON_TIME_ZONE, "Europe/Paris", "America/New_York", "UTC"];

/** Hourly-ish through 2026, the edges of every clock change, and a leap year. */
function instants(): Date[] {
  const out: Date[] = [];
  const hour = 3_600_000;
  for (let i = 0; i < 24 * 366; i += 3)
    out.push(new Date(Date.parse("2026-01-01T00:00:00Z") + i * hour + (i % 7) * 600_000));
  for (const edge of [
    "2026-03-08T07:00:00Z",
    "2026-03-29T01:00:00Z",
    "2026-10-25T01:00:00Z",
    "2026-11-01T06:00:00Z",
    "2028-02-29T12:00:00Z",
  ]) {
    for (let m = -180; m <= 180; m += 30) out.push(new Date(Date.parse(edge) + m * 60_000));
  }
  return out;
}

describe("shortMonthFormat", () => {
  const sets: Intl.DateTimeFormatOptions[] = [
    { day: "numeric" },
    { day: "numeric", year: "numeric" },
    { year: "2-digit", day: "numeric" },
    { day: "numeric", hour: "2-digit", minute: "2-digit" },
  ];

  it("matches en-GB Intl with a three-letter month in every zone", () => {
    for (const zone of ZONES) {
      for (const options of sets) {
        const format = shortMonthFormat(zone, options);
        const intl = new Intl.DateTimeFormat("en-GB", {
          timeZone: zone,
          ...options,
          month: "short",
        });
        for (const d of instants())
          expect(format.format(d)).toBe(intl.format(d).replace(/\bSept\b/, "Sep"));
      }
    }
  });

  it("writes September as Sep", () => {
    expect(
      shortMonthFormat(LONDON_TIME_ZONE, { day: "numeric" }).format(
        new Date("2026-09-03T12:00:00Z"),
      ),
    ).toBe("3 Sep");
  });
});

describe("addCalendarDays", () => {
  it("is date-fns addDays on the zoned date, in every zone", () => {
    for (const zone of ZONES) {
      for (const d of instants()) {
        for (const days of [-29, -1, 1, 7]) {
          expect(addCalendarDays(d, days, zone).getTime()).toBe(
            addDays(new TZDate(d, zone), days).getTime(),
          );
        }
      }
    }
  });

  it("keeps the wall-clock time and moves the calendar day, across clock changes", () => {
    const wall = (d: Date, zone: string) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(d);
    for (const zone of ZONES) {
      for (const d of instants()) {
        const next = addCalendarDays(d, 1, zone);
        const expectedDay = new Date(`${dayKey(d, zone)}T00:00:00Z`);
        expectedDay.setUTCDate(expectedDay.getUTCDate() + 1);
        expect(dayKey(next, zone)).toBe(expectedDay.toISOString().slice(0, 10));
        // Same wall-clock time unless that time does not exist on the target day.
        const skipped = wall(next, zone) !== wall(d, zone);
        if (skipped) expect(["Europe/London", "Europe/Paris", "America/New_York"]).toContain(zone);
      }
    }
  });

  it("adds a day over the London spring change as 23 hours and over autumn as 25", () => {
    const evening = new Date("2026-03-28T20:00:00Z");
    expect(addCalendarDays(evening, 1, LONDON_TIME_ZONE).toISOString()).toBe(
      "2026-03-29T19:00:00.000Z",
    );
    const autumn = new Date("2026-10-24T20:00:00Z");
    expect(addCalendarDays(autumn, 1, LONDON_TIME_ZONE).toISOString()).toBe(
      "2026-10-25T21:00:00.000Z",
    );
  });
});
