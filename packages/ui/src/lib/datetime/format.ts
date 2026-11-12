import {
  formatDate,
  formatWeekday,
  instantFromDatetimeFormString as instantFromFormString,
  instantToWallClock,
  resolveWallClock,
  toDatetimeFormString as toFormString,
} from "@auction/datetime";

import { DEFAULT_AUCTION_ZONE } from "./constants.js";
import type { DateFormString, DatetimeFormString, TimeFormString, ZonedInstant } from "./types.js";

/** Parse `yyyy-MM-dd'T'HH:mm` as a zoned wall-clock time. */
export function fromDatetimeFormString(
  raw: DatetimeFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
): ZonedInstant {
  return { instant: instantFromFormString(raw, zone), zone };
}

/** Format an instant as `yyyy-MM-dd'T'HH:mm` in `zone`. */
export function toDatetimeFormString(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): DatetimeFormString {
  return toFormString(instant, zone);
}

/** "Mon 15 Jun 2026, 2:30 PM": the 12-hour label picker triggers show. */
export function formatDatetimeDisplayHuman(
  raw: DatetimeFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
): string {
  if (!raw.trim()) return "";
  const { instant } = fromDatetimeFormString(raw, zone);
  if (Number.isNaN(instant.getTime())) return "";
  const { time } = instantToWallClock(instant, zone);
  const hour24 = Number(time.slice(0, 2));
  const minutes = time.slice(3, 5);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 < 12 ? "AM" : "PM";
  return `${formatWeekday(instant, zone)} ${formatDate(instant, zone)}, ${hour12}:${minutes} ${meridiem}`;
}

export function fromDateFormString(
  raw: DateFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
): ZonedInstant {
  return fromDatetimeFormString(`${raw.trim()}T00:00`, zone);
}

export function toDateFormString(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): DateFormString {
  return instantToWallClock(instant, zone).day;
}

/** The instant `raw` ("HH:mm") means on the day `referenceInstant` falls on in `zone`. */
export function fromTimeFormString(
  raw: TimeFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
  referenceInstant: Date = new Date(),
): ZonedInstant {
  const [hourStr, minuteStr] = raw.trim().split(":");
  const clock = `${String(Number(hourStr ?? 0)).padStart(2, "0")}:${String(Number(minuteStr ?? 0)).padStart(2, "0")}`;
  const { day } = instantToWallClock(referenceInstant, zone);
  return { instant: resolveWallClock(day, clock, zone) ?? new Date(Number.NaN), zone };
}

export function toTimeFormString(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): TimeFormString {
  return instantToWallClock(instant, zone).time;
}

/** Date for react-day-picker (instant in zone, as JS Date). */
export function toCalendarDate(instant: Date, zone: string = DEFAULT_AUCTION_ZONE): Date {
  const [year, month, day] = instantToWallClock(instant, zone).day.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** Combine date (yyyy-MM-dd) + time (HH:mm) in zone → instant. */
export function combineDateAndTime(
  date: DateFormString,
  time: TimeFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
): ZonedInstant {
  return fromDatetimeFormString(`${date}T${time}`, zone);
}

export function zonedInstantToDatetimeFormString(value: ZonedInstant): DatetimeFormString {
  return toDatetimeFormString(value.instant, value.zone);
}

export function instantFromZoned(value: ZonedInstant): Date {
  return value.instant;
}

/** Parse a datetime form string as wall-clock time in `zone` and return UTC instant. */
export function instantFromDatetimeFormString(
  raw: string,
  zone: string = DEFAULT_AUCTION_ZONE,
): Date {
  return fromDatetimeFormString(raw, zone).instant;
}
