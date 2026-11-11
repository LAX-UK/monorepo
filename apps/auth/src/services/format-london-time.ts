/**
 * Moments in security notices, in the one style LAX shows people: "Thu 12 Nov, 04:49 GMT". The
 * shared formatter lives in `@auction/datetime`, which Identity must not depend on, so it
 * stays extractable; this writes out the same style, pinned string by string here and, against
 * `@auction/datetime` itself, by apps/api's identity-time-format-parity test.
 * A notice is about the present, so the year is left out.
 */
const LONDON = "Europe/London";
const LOCALE = "en-GB";

type ZoneFormats = {
  weekday: Intl.DateTimeFormat;
  dayMonth: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  zoneName: Intl.DateTimeFormat;
  usZoneName: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
};
const formatsByZone = new Map<string, ZoneFormats>();

function formatsFor(zone: string): ZoneFormats {
  let formats = formatsByZone.get(zone);
  if (!formats) {
    const make = (options: Intl.DateTimeFormatOptions, locale = LOCALE) =>
      new Intl.DateTimeFormat(locale, { timeZone: zone, ...options });
    formats = {
      weekday: make({ weekday: "short" }),
      dayMonth: make({ day: "numeric", month: "short" }),
      time: make({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      zoneName: make({ timeZoneName: "short" }),
      usZoneName: make({ timeZoneName: "short" }, "en-US"),
      date: make({ day: "numeric", month: "long", year: "numeric" }),
    };
    formatsByZone.set(zone, formats);
  }
  return formats;
}

function zoneNameOf(format: Intl.DateTimeFormat, at: Date): string {
  return format.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** "GMT"/"BST" for London, the runtime's abbreviation elsewhere (en-US's for American zones). */
function shortZoneName(zone: string, at: Date, formats: ZoneFormats): string {
  const name = zoneNameOf(formats.zoneName, at);
  if (zone === LONDON) return name === "BST" ? "BST" : "GMT";
  if (!/^GMT[+-]/.test(name)) return name;
  const american = zoneNameOf(formats.usZoneName, at);
  return american && !/^GMT[+-]/.test(american) ? american : name;
}

/** "America/New_York" becomes "New York". */
function placeName(zone: string): string {
  return (zone.split("/").pop() ?? zone).replaceAll("_", " ");
}

/** "Thu 12 Nov, 04:49 GMT": the moment as a person in London would read it. */
export function formatLondonTime(at: Date): string {
  return formatNoticeTime(at, null);
}

/** "22 November 2026": the calendar day in London, for dates that are not a moment. */
export function formatLondonDate(at: Date): string {
  return formatsFor(LONDON).date.format(at);
}

/**
 * "Sat 24 Oct, 07:30 GMT+11 (Sydney)": the moment on the person's own clock, with the place named
 * so an offset alone is never all they have to go on. A personal event is shown on the person's
 * clock only: their saved Account zone, or London when they have none.
 */
export function formatNoticeTime(at: Date, savedZone: string | null): string {
  const zone = savedZone ?? LONDON;
  const formats = formatsFor(zone);
  const day = formats.dayMonth.format(at).replace(/\bSept\b/, "Sep");
  const when = `${formats.weekday.format(at)} ${day}, ${formats.time.format(at)} ${shortZoneName(zone, at, formats)}`;
  return zone === LONDON ? when : `${when} (${placeName(zone)})`;
}
