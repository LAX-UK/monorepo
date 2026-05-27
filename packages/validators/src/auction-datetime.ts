import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** Canonical IANA zone for auction scheduling (matches @auction/ui). */
export const DEFAULT_AUCTION_ZONE = "Europe/London";

/** Build a TZDate from parts interpreted in `zone`. */
function tzDateFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  zone: string = DEFAULT_AUCTION_ZONE,
): TZDate {
  return new TZDate(year, month - 1, day, hour, minute, 0, 0, zone);
}

/** Format an instant as `yyyy-MM-dd'T'HH:mm` in `zone` (admin form wire format). */
export function toAuctionDatetimeFormString(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): string {
  const tz = new TZDate(instant, zone);
  return format(tz, "yyyy-MM-dd'T'HH:mm");
}

/** Parse `yyyy-MM-dd'T'HH:mm` as wall-clock time in `zone` → UTC instant. */
export function instantFromAuctionDatetimeFormString(
  raw: string,
  zone: string = DEFAULT_AUCTION_ZONE,
): Date {
  const trimmed = raw.trim();
  if (!trimmed) return new Date(Number.NaN);
  const [datePart, timePart = "00:00"] = trimmed.split("T");
  const dateBits = datePart?.split("-").map(Number) ?? [];
  const timeBits = timePart.split(":").map(Number);
  const year = dateBits[0] ?? 0;
  const month = dateBits[1] ?? 1;
  const day = dateBits[2] ?? 1;
  const hour = timeBits[0] ?? 0;
  const minute = timeBits[1] ?? 0;
  const tz = tzDateFromParts(year, month, day, hour, minute, zone);
  return new Date(tz.getTime());
}

/** UTC epoch for the start of the auction-minute bucket containing `instant`. */
export function auctionMinuteEpoch(instant: Date, zone: string = DEFAULT_AUCTION_ZONE): number {
  const form = toAuctionDatetimeFormString(instant, zone);
  return instantFromAuctionDatetimeFormString(form, zone).getTime();
}

/** True when `startTime` is in the current or a future auction minute (publish gate). */
export function isStartInFutureForPublish(startTime: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(startTime.getTime())) return false;
  return auctionMinuteEpoch(startTime) >= auctionMinuteEpoch(now);
}

/** Human-readable auction datetime for staff-facing errors. */
export function formatAuctionDatetimeDisplay(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): string {
  if (Number.isNaN(instant.getTime())) return "";
  const tz = new TZDate(instant, zone);
  return format(tz, "EEE d MMM yyyy, HH:mm");
}
