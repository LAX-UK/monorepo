import { formatTime } from "./date-style.js";
import type { LocalTime } from "./local-time.js";
import { zoneFormats } from "./zone-formats.js";

const DAY_NOTE = { "-1": ", the previous day", "0": "", "1": ", the next day" } as const;

/**
 * The sentence a screen reader hears for the chip (TZ14), so a different day is heard and not
 * only seen as a tint: "Your time: Friday 13 November at 05:00 in Sydney, the next day."
 */
export function spokenLocalTime(instant: Date, local: LocalTime): string {
  const formats = zoneFormats(local.zone);
  const weekday = formats.weekdayLong.format(instant);
  const dayMonth = formats.dayLongMonth.format(instant);
  const time = formatTime(instant, local.zone);
  return `Your time: ${weekday} ${dayMonth} at ${time} in ${local.city}${DAY_NOTE[String(local.dayShift) as keyof typeof DAY_NOTE]}.`;
}
