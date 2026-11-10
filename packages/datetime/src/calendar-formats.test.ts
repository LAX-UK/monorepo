import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDayMonthOnly,
  formatTimeUnpadded,
  formatWeekdayDate,
  formatWeekdayDateTime,
  formatWeekdayDayMonth,
  runtimeTimeZone,
} from "./calendar-formats.js";
import { formatDate } from "./date-style.js";
import { STAGE_C_INSTANTS, STAGE_C_ZONES } from "./testing/stage-c-instants.js";

const intl = (timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, ...options });

describe("the added formats equal the Intl output they replace", () => {
  for (const zone of STAGE_C_ZONES) {
    it(`in ${zone}`, () => {
      for (const d of STAGE_C_INSTANTS) {
        const at = `${zone} @ ${d.toISOString()}`;
        const sept = { engineSept: true };
        expect(formatDayMonthOnly(d, zone, sept), at).toBe(
          intl(zone, { day: "numeric", month: "short" }).format(d),
        );
        expect(formatWeekdayDayMonth(d, zone, sept), at).toBe(
          intl(zone, { weekday: "short", day: "numeric", month: "short" }).format(d),
        );
        expect(formatDate(d, zone, { month: "short", ...sept }), at).toBe(
          intl(zone, { day: "numeric", month: "short", year: "numeric" }).format(d),
        );
        expect(formatDate(d, zone, { month: "long" }), at).toBe(
          intl(zone, { dateStyle: "long" }).format(d),
        );
        const dateTime = intl(zone, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(d);
        expect(formatDateTime(d, zone, sept), at).toBe(dateTime);
        expect(formatDateTime(d, zone, sept), at).toBe(
          intl(zone, { dateStyle: "medium", timeStyle: "short" }).format(d),
        );
        expect(formatWeekdayDate(d, zone), at).toBe(
          intl(zone, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d),
        );
        expect(formatWeekdayDate(d, zone, { year: false }), at).toBe(
          intl(zone, { weekday: "long", day: "numeric", month: "long" }).format(d),
        );
        expect(formatWeekdayDateTime(d, zone), at).toBe(
          intl(zone, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(d),
        );
        expect(formatTimeUnpadded(d, zone), at).toBe(
          intl(zone, { hour: "numeric", minute: "2-digit" }).format(d),
        );
      }
    });
  }

  it("spells September in the house style unless the line keeps the runtime's", () => {
    const sept = new Date("2026-09-05T08:05:00Z");
    expect(formatDayMonthOnly(sept, "UTC")).toBe("5 Sep");
    expect(formatWeekdayDayMonth(sept, "UTC")).toBe("Sat 5 Sep");
    expect(formatDateTime(sept, "UTC")).toBe("5 Sep 2026, 08:05");
    expect(formatDate(sept, "UTC", { month: "short", engineSept: true })).toBe("5 Sept 2026");
  });

  it("names the runtime's own zone", () => {
    expect(runtimeTimeZone()).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
