import { describe, expect, it } from "vitest";
import { LONDON_TIME_ZONE } from "./constants.js";
import * as style from "./date-style.js";
import { dayKey, dayOffset } from "./day.js";
import * as legacy from "./testing/legacy-london-time.js";
import { shortZoneName } from "./zone-formats.js";

/** Hourly through a year, plus the edges of both London clock changes and a leap year. */
function sweep(): Date[] {
  const instants: Date[] = [];
  const hour = 3_600_000;
  for (const start of ["2026-01-01T00:00:00Z", "2027-12-30T00:00:00Z", "2028-02-27T00:00:00Z"]) {
    const from = Date.parse(start);
    const hours = start.startsWith("2026") ? 24 * 365 : 24 * 4;
    for (let i = 0; i < hours; i += 5) instants.push(new Date(from + i * hour + (i % 7) * 600_000));
  }
  for (const edge of ["2026-03-29T01:00:00Z", "2026-10-25T01:00:00Z"]) {
    for (let minutes = -120; minutes <= 120; minutes += 15) {
      instants.push(new Date(Date.parse(edge) + minutes * 60_000));
    }
  }
  return instants;
}

const NOW = new Date("2026-11-10T09:00:00Z");
const Z = LONDON_TIME_ZONE;

describe("the moved one date style is byte-identical to the old London formatters", () => {
  const instants = sweep();

  it("sweeps enough instants to mean something", () => {
    expect(instants.length).toBeGreaterThan(1500);
  });

  it("matches on every instant for every formatter", () => {
    const mismatches: string[] = [];
    const check = (name: string, instant: Date, next: string, old: string) => {
      if (next !== old) mismatches.push(`${name} @ ${instant.toISOString()}: ${next} != ${old}`);
    };
    for (const d of instants) {
      check("when", d, style.formatWhen(d, Z, NOW), legacy.formatLondonWhen(d, NOW));
      check("time", d, style.formatTime(d, Z), legacy.formatLondonTime(d));
      check("timeZone", d, style.formatTimeWithZone(d, Z), legacy.formatLondonTimeWithZone(d));
      check("zoneName", d, shortZoneName(Z, d), legacy.londonZoneName(d));
      check("dayKey", d, dayKey(d, Z), legacy.londonDayKey(d));
      check("date", d, style.formatDate(d, Z), legacy.formatLondonDate(d));
      check(
        "dateLong",
        d,
        style.formatDate(d, Z, { month: "long" }),
        legacy.formatLondonDate(d, { month: "long" }),
      );
      check("full", d, style.formatFullMoment(d, Z), legacy.formatLondonFullMoment(d));
      check("monthYear", d, style.formatMonthYear(d, Z), legacy.formatLondonMonthYear(d));
      check(
        "monthYearShort",
        d,
        style.formatMonthYear(d, Z, { short: true }),
        legacy.formatLondonMonthYear(d, { short: true }),
      );
      check("weekday", d, style.formatWeekday(d, Z), legacy.formatLondonWeekday(d));
      check("dayMonth", d, style.formatDayMonth(d, Z, NOW), legacy.formatLondonDayMonth(d, NOW));
      check("offset", d, String(dayOffset(d, NOW, Z)), String(legacy.londonDayOffset(d, NOW)));
      check("moment", d, style.formatMoment(d, Z, NOW), legacy.formatLondonMoment(d, NOW));
      check(
        "momentNoTime",
        d,
        style.formatMoment(d, Z, NOW, { time: false, inSentence: true }),
        legacy.formatLondonMoment(d, NOW, { time: false, inSentence: true }),
      );
    }
    expect(mismatches).toEqual([]);
  });

  it("matches on date ranges across days, months and years", () => {
    const starts = instants.filter((_, i) => i % 40 === 0);
    const gaps = [0, 6, 30, 26 * 3_600_000, 3 * 86_400_000, 40 * 86_400_000, 400 * 86_400_000];
    for (const start of starts) {
      for (const gap of gaps) {
        const end = new Date(start.getTime() + gap);
        expect(style.formatDateRange(start, end, Z)).toBe(legacy.formatLondonDateRange(start, end));
      }
    }
  });

  it("spells September with three letters", () => {
    expect(style.formatDate(new Date("2026-09-15T12:00:00Z"), Z)).toBe("15 Sep 2026");
  });
});
