import {
  formatDate,
  formatTime,
  formatWeekday,
  instantFromDatetimeFormString,
  toDatetimeFormString,
} from "@auction/datetime";

/** Canonical IANA zone for auction scheduling (matches @auction/ui). */
export const DEFAULT_AUCTION_ZONE = "Europe/London";

/** Format an instant as `yyyy-MM-dd'T'HH:mm` in `zone` (admin form wire format). */
export function toAuctionDatetimeFormString(
  instant: Date,
  zone: string = DEFAULT_AUCTION_ZONE,
): string {
  return toDatetimeFormString(instant, zone);
}

/** Parse `yyyy-MM-dd'T'HH:mm` as wall-clock time in `zone` → UTC instant. */
export function instantFromAuctionDatetimeFormString(
  raw: string,
  zone: string = DEFAULT_AUCTION_ZONE,
): Date {
  return instantFromDatetimeFormString(raw, zone);
}

const MINUTE_MS = 60_000;

/**
 * UTC epoch for the start of the auction minute containing `instant`.
 *
 * Every auction zone's UTC offset is a whole number of minutes, so the London minute starts on a
 * UTC minute boundary and truncating the instant is exact. Round-tripping through the London
 * wall-clock form instead collapses the repeated hour when the clocks go back: two instants an
 * hour apart share one wall-clock reading and would compare as equal.
 */
export function auctionMinuteEpoch(instant: Date): number {
  return Math.floor(instant.getTime() / MINUTE_MS) * MINUTE_MS;
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
  return `${formatWeekday(instant, zone)} ${formatDate(instant, zone)}, ${formatTime(instant, zone)}`;
}
