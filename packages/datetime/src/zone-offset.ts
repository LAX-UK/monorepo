/**
 * Minutes east of UTC for a zone at an instant, read from `Intl`. A port of `tzOffset` from
 * `@date-fns/tz` 1.5.0 (MIT, Sasha Koss and Lesha Koss), kept step for step so it answers exactly
 * as that function does (`zone-offset.test.ts` compares the two). It lives here so the date and
 * time code that public pages load does not pull in `@date-fns/tz`.
 */
const offsetFormatCache: Record<string, (date: Date) => string> = {};
const offsetCache: Record<string, number> = {};
const offsetRe = /([+-]\d\d):?(\d\d)?/;

function calcOffset(cacheStr: string, values: ReadonlyArray<string | undefined>): number {
  const hours = +(values[0] || 0);
  const minutes = +(values[1] || 0);
  // Seconds, as a fraction of a minute.
  const seconds = +(values[2] || 0) / 60;
  offsetCache[cacheStr] =
    hours * 60 + minutes > 0 ? hours * 60 + minutes + seconds : hours * 60 - minutes - seconds;
  return offsetCache[cacheStr];
}

/** UTC offset in minutes of `timeZone` (IANA name or `±HH:MM`) at `date`; `NaN` when unknown. */
export function zoneOffsetMinutes(timeZone: string, date: Date): number {
  try {
    // "longOffset" gives a stable string like "5/19/2026, GMT-08:00".
    offsetFormatCache[timeZone] ||= new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).format;
    const format = offsetFormatCache[timeZone];
    const offsetStr = format(date).split("GMT")[1] as string;
    if (offsetStr in offsetCache) return offsetCache[offsetStr] as number;
    return calcOffset(offsetStr, offsetStr.split(":"));
  } catch {
    // Runtimes that reject offset zones ("+05:30") in Intl: read the offset from the name.
    if (timeZone in offsetCache) return offsetCache[timeZone] as number;
    const captures = timeZone?.match(offsetRe);
    if (captures) return calcOffset(timeZone, captures.slice(1));
    return Number.NaN;
  }
}
