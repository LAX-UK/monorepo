import { cityName } from "./city.js";
import { formatDayMonth, formatTime, formatWeekday } from "./date-style.js";
import { calendarDaysBetween, dayKey } from "./day.js";
import { sameOffset } from "./offset.js";
import { normaliseViewerZone } from "./zone.js";

/** The visitor's own clock at a moment, for the chip and for plain row text. */
export type LocalTime = {
  /** "Fri 13 Nov". */
  day: string;
  /** "05:00". */
  time: string;
  /** "Sydney". */
  city: string;
  /** -1, 0 or 1: the visitor's calendar day against the official one. */
  dayShift: -1 | 0 | 1;
  /** "20:00 in Cairo", or "Fri 13 Nov, 05:00 in Sydney" when the day differs. */
  text: string;
  /** The viewer's zone, as the runtime knows it. */
  zone: string;
};

function dayShiftBetween(instant: Date, officialZone: string, viewerZone: string): -1 | 0 | 1 {
  const shift = calendarDaysBetween(dayKey(instant, officialZone), dayKey(instant, viewerZone));
  return shift > 0 ? 1 : shift < 0 ? -1 : 0;
}

/**
 * The visitor's clock at `instant`, or `null` when there is nothing to add: the zone is missing,
 * invalid, UTC or `Etc/*`, or the visitor's clock reads the same as the official one at that
 * moment (Dublin and Lisbon in winter; offsets are compared at the instant, not by name).
 */
export function localTimeAt(
  instant: Date,
  officialZone: string,
  viewerZone: string | null | undefined,
  now: Date,
): LocalTime | null {
  const zone = normaliseViewerZone(viewerZone);
  if (!zone || sameOffset(instant, officialZone, zone)) return null;

  const dayShift = dayShiftBetween(instant, officialZone, zone);
  const day = `${formatWeekday(instant, zone)} ${formatDayMonth(instant, zone, now)}`;
  const time = formatTime(instant, zone);
  const city = cityName(zone);
  const text = dayShift === 0 ? `${time} in ${city}` : `${day}, ${time} in ${city}`;
  return { day, time, city, dayShift, text, zone };
}
