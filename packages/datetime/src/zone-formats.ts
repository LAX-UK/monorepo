import { LOCALE, LONDON_TIME_ZONE } from "./constants.js";

type Format = Pick<Intl.DateTimeFormat, "format">;

/** The Intl formatters one zone needs. Building them is the expensive part, so each zone's set is built once. */
export type ZoneFormats = {
  dayKey: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  zoneName: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
  dayMonth: Format;
  dayMonthYear: Format;
  dayLongMonth: Intl.DateTimeFormat;
  dayLongMonthYear: Intl.DateTimeFormat;
  monthYear: Intl.DateTimeFormat;
  shortMonthYear: Format;
  weekday: Intl.DateTimeFormat;
  weekdayLong: Intl.DateTimeFormat;
};

/**
 * A formatter for a date with a three-letter month ("Sep"), whatever the runtime's locale data:
 * en-GB spells September "Sept", which would be the one four-letter month in a column of dates.
 * `options` choose the other parts (day, year, hour, minute...) and `month` is always "short".
 */
export function shortMonthFormat(timeZone: string, options: Intl.DateTimeFormatOptions): Format {
  const inner = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options, month: "short" });
  return { format: (date) => inner.format(date).replace(/\bSept\b/, "Sep") };
}

function build(timeZone: string): ZoneFormats {
  const make = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
  return {
    dayKey: new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: make({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    zoneName: make({ timeZoneName: "short" }),
    day: make({ day: "numeric" }),
    dayMonth: shortMonthFormat(timeZone, { day: "numeric" }),
    dayMonthYear: shortMonthFormat(timeZone, { day: "numeric", year: "numeric" }),
    dayLongMonth: make({ day: "numeric", month: "long" }),
    dayLongMonthYear: make({ day: "numeric", month: "long", year: "numeric" }),
    monthYear: make({ month: "long", year: "numeric" }),
    shortMonthYear: shortMonthFormat(timeZone, { year: "numeric" }),
    weekday: make({ weekday: "short" }),
    weekdayLong: make({ weekday: "long" }),
  };
}

const cache = new Map<string, ZoneFormats>();

export function zoneFormats(timeZone: string): ZoneFormats {
  let formats = cache.get(timeZone);
  if (!formats) {
    formats = build(timeZone);
    cache.set(timeZone, formats);
  }
  return formats;
}

/** The short zone name at an instant: "GMT"/"BST" for London, the runtime's own abbreviation elsewhere. */
export function shortZoneName(timeZone: string, instant: Date): string {
  const name = zoneNameIn(zoneFormats(timeZone).zoneName, instant);
  if (timeZone === LONDON_TIME_ZONE) return name === "BST" ? "BST" : "GMT";
  return /^GMT[+-]/.test(name) ? (americanName(timeZone, instant) ?? name) : name;
}

function zoneNameIn(format: Intl.DateTimeFormat, instant: Date): string {
  return format.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "";
}

const usNameFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * en-GB can only offer an offset ("GMT-5") for the American zones; en-US names them ("EST",
 * "PDT"). Used only when en-GB has no name of its own and en-US has a real abbreviation.
 */
function americanName(timeZone: string, instant: Date): string | null {
  let format = usNameFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" });
    usNameFormats.set(timeZone, format);
  }
  const name = zoneNameIn(format, instant);
  return /^[A-Z]{2,5}$/.test(name) ? name : null;
}
