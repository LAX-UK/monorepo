import { DATE_BANDS, dateBand } from "./notification-presenters";

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const FULL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * When a notification arrived, as its row shows it: the time under Today and Yesterday ("14:02",
 * the day heading already says which), otherwise the date ("29 Oct").
 */
export function inboxTime(date: Date, now: Date = new Date()): string {
  const band = dateBand(date, now);
  return band === DATE_BANDS[0] || band === DATE_BANDS[1] ? TIME.format(date) : DAY.format(date);
}

/** The full date and time, for the tooltip: "Saturday 31 October 2026, 14:02". */
export function inboxFullTime(date: Date): string {
  return FULL.format(date);
}
