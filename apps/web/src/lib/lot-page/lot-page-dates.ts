import {
  formatLondonDayMonth,
  formatLondonTimeWithZone,
  formatLondonWeekday,
  londonDayKey,
  toDate,
} from "@/lib/datetime/london-time";

/** "Tue 10 Nov": a day a bidder plans around, in London time. */
export function formatLotDay(iso: string, now: Date): string {
  const date = toDate(iso);
  if (!date) return "";
  return `${formatLondonWeekday(date)} ${formatLondonDayMonth(date, now)}`;
}

/** "Tue 10 Nov, 18:00 GMT", or "today, 21:06 GMT" when the moment falls on London's today. */
export function formatLotMoment(iso: string, now: Date): string {
  const date = toDate(iso);
  if (!date) return "";
  const time = formatLondonTimeWithZone(date);
  if (londonDayKey(date) === londonDayKey(now)) return `today, ${time}`;
  return `${formatLotDay(iso, now)}, ${time}`;
}

/** "21:06 GMT". */
export function formatLotClock(iso: string): string {
  const date = toDate(iso);
  return date ? formatLondonTimeWithZone(date) : "";
}
