import type { LotStatusTone } from "./lifecycle-copy.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type TimeLeftTone = "calm" | "soon" | "final";

export type TimeLeftBand = {
  tone: TimeLeftTone;
  /** The band applies while the time left is below this (exclusive); the last band has none. */
  belowMs: number | null;
  /** The word that replaces "Time left" as the clock tightens. */
  label: string;
  statusTone: LotStatusTone;
  showSeconds: boolean;
};

const FINAL_BAND: TimeLeftBand = {
  tone: "final",
  belowMs: 2 * MINUTE_MS,
  label: "Final minutes",
  statusTone: "danger",
  showSeconds: true,
};
const SOON_BAND: TimeLeftBand = {
  tone: "soon",
  belowMs: HOUR_MS,
  label: "Closing soon",
  statusTone: "warning",
  showSeconds: false,
};
const CALM_BAND: TimeLeftBand = {
  tone: "calm",
  belowMs: null,
  label: "Time left",
  statusTone: "neutral",
  showSeconds: false,
};

/**
 * Calm over an hour, soon under an hour, final under two minutes and during any extension.
 * Kept as a table in one place so operations can tune the thresholds. Ordered tightest first.
 */
export const TIME_LEFT_BANDS: readonly TimeLeftBand[] = [FINAL_BAND, SOON_BAND, CALM_BAND];

/** The band for `msLeft`. An extended lot is always in the final band. */
export function timeLeftBand(msLeft: number, opts: { extended?: boolean } = {}): TimeLeftBand {
  if (opts.extended) return FINAL_BAND;
  const ms = Number.isFinite(msLeft) ? Math.max(0, msLeft) : 0;
  return TIME_LEFT_BANDS.find((band) => band.belowMs !== null && ms < band.belowMs) ?? CALM_BAND;
}

function unit(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function pair(larger: number, largerWord: string, smaller: number, smallerWord: string): string {
  return smaller > 0
    ? `${unit(larger, largerWord)} ${unit(smaller, smallerWord)}`
    : unit(larger, largerWord);
}

/**
 * The time left in words, using the two largest units: days and hours, hours and minutes,
 * minutes and seconds. Seconds appear only when asked for (the final band).
 */
export function formatTimeLeft(msLeft: number, opts: { showSeconds?: boolean } = {}): string {
  const total = Math.max(0, Math.floor((Number.isFinite(msLeft) ? msLeft : 0) / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (days > 0) return pair(days, "day", hours, "hour");
  if (hours > 0) return pair(hours, "hour", minutes, "minute");
  if (opts.showSeconds) {
    return minutes > 0 ? pair(minutes, "minute", seconds, "second") : unit(seconds, "second");
  }
  return unit(Math.max(1, minutes), "minute");
}

export type TimeLeftView = {
  tone: TimeLeftTone;
  /** "Time left", "Closing soon" or "Final minutes". */
  label: string;
  statusTone: LotStatusTone;
  text: string;
};

export function timeLeftView(msLeft: number, opts: { extended?: boolean } = {}): TimeLeftView {
  const band = timeLeftBand(msLeft, opts);
  return {
    tone: band.tone,
    label: band.label,
    statusTone: band.statusTone,
    text: formatTimeLeft(msLeft, { showSeconds: band.showSeconds }),
  };
}

/** Time marks a screen reader hears once each, tightest last. */
export const TIME_LEFT_MARKS: readonly { ms: number; announcement: string }[] = [
  { ms: 5 * MINUTE_MS, announcement: "5 minutes left" },
  { ms: MINUTE_MS, announcement: "1 minute left" },
];

/** The mark the clock passed between two readings, or `null`. The tightest mark wins. */
export function timeMarkCrossed(previousMs: number, currentMs: number): string | null {
  if (!(currentMs < previousMs)) return null;
  const crossed = TIME_LEFT_MARKS.filter((mark) => previousMs > mark.ms && currentMs <= mark.ms);
  return crossed[crossed.length - 1]?.announcement ?? null;
}
