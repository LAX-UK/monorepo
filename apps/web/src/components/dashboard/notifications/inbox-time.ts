import {
  formatLondonDayMonth,
  formatLondonFullMoment,
  formatLondonTime,
} from "@/lib/datetime/london-time";
import { DATE_BANDS, dateBand } from "./notification-presenters";

/**
 * When a notification arrived, as its row shows it: the time under Today and Yesterday ("14:02",
 * the day heading already says which), otherwise the date ("29 Oct"). Always London time, so the
 * server and the browser draw the same text.
 */
export function inboxTime(date: Date, now: Date = new Date()): string {
  const band = dateBand(date, now);
  return band === DATE_BANDS[0] || band === DATE_BANDS[1]
    ? formatLondonTime(date)
    : formatLondonDayMonth(date, now);
}

/** The full date and time, for the tooltip: "Saturday 31 October 2026, 14:02". */
export function inboxFullTime(date: Date): string {
  return formatLondonFullMoment(date);
}
