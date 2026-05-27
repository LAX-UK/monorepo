import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { DEFAULT_AUCTION_ZONE } from "./constants.js";
import type { DateFormString, DatetimeFormString, TimeFormString, ZonedInstant } from "./types.js";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build a TZDate from parts interpreted in `zone`. */
export function tzDateFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  zone: string = DEFAULT_AUCTION_ZONE,
): TZDate {
  return new TZDate(year, month - 1, day, hour, minute, 0, 0, zone);
}

/** Parse `yyyy-MM-dd'T'HH:mm` as a zoned wall-clock time. */
export function fromDatetimeFormString(
  raw: DatetimeFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
): ZonedInstant {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { instant: new Date(Number.NaN), zone };
  }
  const [datePart, timePart = "00:00"] = trimmed.split("T");
  const dateBits = datePart?.split("-").map(Number) ?? [];
  const timeBits = timePart.split(":").map(Number);
  const year = dateBits[0] ?? 0;
  const month = dateBits[1] ?? 1;
  const day = dateBits[2] ?? 1;
  const hour = timeBits[0] ?? 0;
  const minute = timeBits[1] ?? 0;
  const tz = tzDateFromParts(year, month, day, hour, minute, zone);
  return { instant: new Date(tz.getTime()), zone };
}

/** Format an instant as `yyyy-MM-dd'T'HH:mm` in `zone`. */
export function toDatetimeFormString(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): DatetimeFormString {
  const tz = new TZDate(instant, zone);
  return format(tz, "yyyy-MM-dd'T'HH:mm");
}

/** Human-readable datetime for picker triggers and display copy. */
export function formatDatetimeDisplayHuman(
  raw: DatetimeFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
): string {
  if (!raw.trim()) return "";
  const { instant } = fromDatetimeFormString(raw, zone);
  const tz = new TZDate(instant, zone);
  return format(tz, "EEE d MMM yyyy, h:mm a");
}

/** @deprecated Use `toDatetimeFormString`. Kept for migration shims. */
export function toDatetimeLocalValue(d: Date, zone: string = DEFAULT_AUCTION_ZONE): string {
  return toDatetimeFormString(d, zone);
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
  const tz = new TZDate(instant, zone);
  return format(tz, "yyyy-MM-dd");
}

export function fromTimeFormString(
  raw: TimeFormString,
  zone: string = DEFAULT_AUCTION_ZONE,
  referenceInstant: Date = new Date(),
): ZonedInstant {
  const trimmed = raw.trim();
  const [hourStr, minuteStr] = trimmed.split(":");
  const hour = Number(hourStr ?? 0);
  const minute = Number(minuteStr ?? 0);
  const ref = new TZDate(referenceInstant, zone);
  const tz = tzDateFromParts(
    ref.getFullYear(),
    ref.getMonth() + 1,
    ref.getDate(),
    hour,
    minute,
    zone,
  );
  return { instant: new Date(tz.getTime()), zone };
}

export function toTimeFormString(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): TimeFormString {
  const tz = new TZDate(instant, zone);
  return `${pad(tz.getHours())}:${pad(tz.getMinutes())}`;
}

/** Date for react-day-picker (instant in zone, as JS Date). */
export function toCalendarDate(instant: Date, zone: string = DEFAULT_AUCTION_ZONE): Date {
  const tz = new TZDate(instant, zone);
  return new Date(tz.getFullYear(), tz.getMonth(), tz.getDate());
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
