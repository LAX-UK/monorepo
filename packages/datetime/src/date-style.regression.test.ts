import { describe, expect, it } from "vitest";
import { LONDON_TIME_ZONE } from "./constants.js";
import * as style from "./date-style.js";
import { dayKey, dayOffset } from "./day.js";
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

describe("the one date style keeps the text it was moved with", () => {
  // Sampled from the sweep and both clock-change edges, recorded while the module still matched
  // the London formatters it replaced byte for byte; a change here is a visible change.
  const instants = sweep().filter((_, i) => i % 12 === 0);

  it("samples enough instants to mean something", () => {
    expect(instants.length).toBeGreaterThan(100);
  });

  it("reads every formatter as recorded", async () => {
    const lines: string[] = [];
    for (const d of instants) {
      lines.push(
        [
          d.toISOString(),
          style.formatWhen(d, Z, NOW),
          style.formatTime(d, Z),
          style.formatTimeWithZone(d, Z),
          shortZoneName(Z, d),
          dayKey(d, Z),
          style.formatDate(d, Z),
          style.formatDate(d, Z, { month: "long" }),
          style.formatFullMoment(d, Z),
          style.formatMonthYear(d, Z),
          style.formatMonthYear(d, Z, { short: true }),
          style.formatWeekday(d, Z),
          style.formatDayMonth(d, Z, NOW),
          String(dayOffset(d, NOW, Z)),
          style.formatMoment(d, Z, NOW),
          style.formatMoment(d, Z, NOW, { time: false, inSentence: true }),
        ].join(" | "),
      );
    }
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("./testing/date-style.golden.txt");
  });

  it("reads date ranges across days, months and years as recorded", async () => {
    const starts = instants.filter((_, i) => i % 4 === 0);
    const gaps = [0, 6, 30, 26 * 3_600_000, 3 * 86_400_000, 40 * 86_400_000, 400 * 86_400_000];
    const lines = starts.flatMap((start) =>
      gaps.map((gap) => style.formatDateRange(start, new Date(start.getTime() + gap), Z)),
    );
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot(
      "./testing/date-style-ranges.golden.txt",
    );
  });

  it("spells September with three letters", () => {
    expect(style.formatDate(new Date("2026-09-15T12:00:00Z"), Z)).toBe("15 Sep 2026");
  });
});

describe("the Stage A additions match the Intl formats they replace", () => {
  const instants = sweep();
  const zones = [LONDON_TIME_ZONE, "Europe/Paris", "America/New_York", "UTC"];

  it("names the month, as en-GB spells it in full", () => {
    for (const zone of zones) {
      const intl = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: zone });
      for (const d of instants) expect(style.formatMonthName(d, zone)).toBe(intl.format(d));
    }
  });

  it("gives the calendar year in the zone", () => {
    for (const zone of zones) {
      const intl = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: zone });
      for (const d of instants) expect(style.calendarYear(d, zone)).toBe(Number(intl.format(d)));
    }
  });

  it("reads a long moment as the long date style does", () => {
    for (const zone of zones) {
      const intl = new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: zone,
      });
      for (const d of instants) expect(style.formatLongMoment(d, zone)).toBe(intl.format(d));
    }
  });
});
