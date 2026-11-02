import { TIME_LEFT_DATE_BEYOND_MS, formatTimeLeft, timeLeftShowsSeconds } from "@auction/domain";

/** Beyond this a moment is told as a date, not counted down (S14); one table in the domain. */
export const COUNTDOWN_DATE_BEYOND_MS = TIME_LEFT_DATE_BEYOND_MS;

/**
 * The one countdown wording for cards, pills and heroes, by the time rule: days and hours, hours and
 * minutes, then minutes and seconds in the final hour ("2 days 14 hours", "5 hours 12 minutes",
 * "42 minutes 10 seconds"). Beyond {@link COUNTDOWN_DATE_BEYOND_MS} callers that know the target
 * tell a date instead (see `opensLine`).
 */
export function formatCountdownForDisplay(ms: number): string {
  return formatTimeLeft(ms, { showSeconds: timeLeftShowsSeconds(ms) });
}

/**
 * The same value in the least width, for a chip too narrow for words: a clock in the final hour
 * ("42:09", tabular so it holds its width while it ticks), then the short form ("5h 12m", "2d 14h").
 */
export function formatCountdownCompact(ms: number): string {
  if (ms >= 60 * 60 * 1000) return formatCountdownShort(ms);
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** The same wording to the minute, for polite live-region announcements that must not chatter. */
export function formatCountdownAnnounce(ms: number): string {
  return formatTimeLeft(ms);
}

/**
 * Countdown in words for lists and cards, two units at most: `2d 3h`, `1h 12m`, `4m 12s`, `45s`.
 * Shorter than the clock face, so it reads at a glance beside a price.
 */
export function formatCountdownShort(ms: number): string {
  const { days, hours, minutes, seconds } = parseCountdownSegments(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export type CountdownTier = "normal" | "urgent" | "critical";

export type CountdownSegments = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/** Split remaining milliseconds into day/hour/minute/second segments for segmented timers. */
export function parseCountdownSegments(msRemaining: number): CountdownSegments {
  const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

/** Urgency for styling: under 1h = urgent (red + pulse), under 10m = critical (row highlight). */
export function countdownTier(ms: number): CountdownTier {
  if (ms <= 0) return "critical";
  if (ms < 10 * 60 * 1000) return "critical";
  if (ms < 60 * 60 * 1000) return "urgent";
  return "normal";
}

/** Screen reader label for the closing countdown. */
export function formatCountdownAriaLabel(ms: number): string {
  if (ms <= 0) return "This lot has closed";
  return `Closes in ${formatCountdownSpoken(ms)}`;
}

/** Time left in words for screen readers, to the minute: "1 hour, 12 minutes". */
export function formatCountdownSpoken(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}
