import {
  dayKey,
  formatDayMonth,
  formatTimeWithZone,
  formatWeekday,
  toDate,
} from "@auction/datetime";

/** "Tue 10 Nov": a day a bidder plans around, in the sale's own zone. */
export function formatLotDay(iso: string, now: Date, zone: string): string {
  const date = toDate(iso);
  if (!date) return "";
  return `${formatWeekday(date, zone)} ${formatDayMonth(date, zone, now)}`;
}

/** "Tue 10 Nov, 18:00 GMT", or "today, 21:06 GMT" when the moment falls on the sale's today. */
export function formatLotMoment(iso: string, now: Date, zone: string): string {
  const date = toDate(iso);
  if (!date) return "";
  const time = formatTimeWithZone(date, zone);
  if (dayKey(date, zone) === dayKey(now, zone)) return `today, ${time}`;
  return `${formatLotDay(iso, now, zone)}, ${time}`;
}

/** "21:06 GMT". */
export function formatLotClock(iso: string, zone: string): string {
  const date = toDate(iso);
  return date ? formatTimeWithZone(date, zone) : "";
}
