/**
 * The wording primitives every countdown surface is built from. Pure functions of the
 * milliseconds left; the surface table in `countdown-policy.ts` decides which one a surface uses.
 */

import { wholeSecondsLeft } from "../lot-page/time-left.js";

export type CountdownSegments = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/** Split remaining milliseconds into day/hour/minute/second segments (whole seconds, rounded up). */
export function parseCountdownSegments(msRemaining: number): CountdownSegments {
  const totalSec = wholeSecondsLeft(msRemaining);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

/**
 * Two units at most: `2d 3h`, `1h 12m`, `4m 12s`, `45s`. Shorter than the clock face, so it reads
 * at a glance beside a price.
 */
export function formatCountdownShort(ms: number): string {
  const { days, hours, minutes, seconds } = parseCountdownSegments(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * The least width, for a chip too narrow for words: a clock in the final hour ("42:09", tabular so
 * it holds its width while it ticks), then the short form ("5h 12m", "2d 14h").
 */
export function formatCountdownCompact(ms: number): string {
  if (wholeSecondsLeft(ms) >= 60 * 60) return formatCountdownShort(ms);
  return formatCountdownClock(ms);
}

/** Minutes and seconds as a clock: "42:09". */
export function formatCountdownClock(ms: number): string {
  const total = wholeSecondsLeft(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export type CountdownTile = { unit: "Days" | "Hours" | "Min" | "Sec"; value: number };

/** The tiles of a segmented countdown: the two largest units only. */
export function countdownTiles(ms: number): readonly [CountdownTile, CountdownTile] {
  const { days, hours, minutes, seconds } = parseCountdownSegments(ms);
  if (days > 0) {
    return [
      { unit: "Days", value: days },
      { unit: "Hours", value: hours },
    ];
  }
  if (hours > 0) {
    return [
      { unit: "Hours", value: hours },
      { unit: "Min", value: minutes },
    ];
  }
  return [
    { unit: "Min", value: minutes },
    { unit: "Sec", value: seconds },
  ];
}

/** Time left in words for screen readers, to the minute: "1 hour, 12 minutes". */
export function formatCountdownSpoken(ms: number): string {
  const totalSec = wholeSecondsLeft(ms);
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

/**
 * Short units with the leading unit unpadded and the rest two digits: "2d 04h 12m 33s",
 * "4h 12m 33s", "42m 09s", "48s". Without seconds the minutes lead the tail: "2d 04h 12m".
 * Tabular figures hold the width while the seconds change.
 */
export function formatCountdownUnits(ms: number, opts: { seconds?: boolean } = {}): string {
  const seconds = opts.seconds ?? true;
  const { days, hours, minutes, seconds: secs } = parseCountdownSegments(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`, `${pad(hours)}h`, `${pad(minutes)}m`);
  } else if (hours > 0) {
    parts.push(`${hours}h`, `${pad(minutes)}m`);
  } else if (minutes > 0 || !seconds) {
    parts.push(`${minutes}m`);
  }
  if (seconds) {
    if (parts.length === 0) return `${secs}s`;
    parts.push(`${pad(secs)}s`);
  }
  return parts.join(" ");
}
