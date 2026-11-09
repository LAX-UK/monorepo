import {
  TIME_LEFT_DATE_BEYOND_MS,
  countdownTiles,
  formatCountdownCompact,
  formatCountdownShort,
  formatCountdownSpoken,
  formatTimeLeft,
  parseCountdownSegments,
  timeLeftShowsSeconds,
} from "@auction/domain";

export {
  countdownTiles,
  formatCountdownCompact,
  formatCountdownShort,
  formatCountdownSpoken,
  parseCountdownSegments,
};
export type { CountdownSegments, CountdownTile } from "@auction/domain";

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

/** The same wording to the minute, for polite live-region announcements that must not chatter. */
export function formatCountdownAnnounce(ms: number): string {
  return formatTimeLeft(ms);
}

export type CountdownTier = "normal" | "urgent" | "critical";

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
