import {
  TIME_LEFT_DATE_BEYOND_MS,
  type TimeLeftTone,
  formatTimeLeft,
  timeLeftBand,
} from "../lot-page/time-left.js";
import {
  type CountdownTile,
  countdownTiles,
  formatCountdownClock,
  formatCountdownCompact,
  formatCountdownSpoken,
} from "./countdown-format.js";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Every place a countdown is shown. A new place is a new row in {@link COUNTDOWN_SURFACES}. */
export type CountdownSurface = "lot" | "lotBar" | "card" | "chip" | "saleHero" | "cover";

/** The wording a surface prints. */
export type CountdownShape = "words" | "compact" | "tiles" | "clock";

type SurfaceRule = {
  /** The time left below which the surface counts seconds; above it, it changes by the minute or more. */
  secondsBelowMs: number;
  shape: CountdownShape;
  /**
   * Beyond this the surface tells a date, not a count. `null` for a surface that keeps its own
   * static text until the count starts.
   */
  dateBeyondMs: number | null;
  /** The surface counts only below `secondsBelowMs` and keeps the caller's own text above it. */
  countsOnlyWithSeconds?: boolean;
};

/**
 * One row per surface. The lot page rows still follow the card rule; the lot page switches to
 * counting seconds under seven days by changing its two rows here and nowhere else.
 */
export const COUNTDOWN_SURFACES: Readonly<Record<CountdownSurface, SurfaceRule>> = {
  lot: { secondsBelowMs: HOUR_MS, shape: "words", dateBeyondMs: TIME_LEFT_DATE_BEYOND_MS },
  lotBar: { secondsBelowMs: HOUR_MS, shape: "words", dateBeyondMs: TIME_LEFT_DATE_BEYOND_MS },
  card: { secondsBelowMs: HOUR_MS, shape: "words", dateBeyondMs: TIME_LEFT_DATE_BEYOND_MS },
  chip: { secondsBelowMs: HOUR_MS, shape: "compact", dateBeyondMs: TIME_LEFT_DATE_BEYOND_MS },
  saleHero: { secondsBelowMs: HOUR_MS, shape: "tiles", dateBeyondMs: TIME_LEFT_DATE_BEYOND_MS },
  cover: {
    secondsBelowMs: HOUR_MS,
    shape: "clock",
    dateBeyondMs: null,
    countsOnlyWithSeconds: true,
  },
};

export type CountdownContext = {
  /** The lot is in a soft-close extension: always the tightest tone. */
  extended?: boolean;
  /** The visitor asked for less motion. Not acted on yet; the lot page rows use it later. */
  reducedMotion?: boolean;
};

export type CountingDisplay = {
  kind: "counting";
  /** The surface's own wording: words, the compact form, the clock, or the first tile's pair. */
  text: string;
  /** The least-width form ("2d 14h", "42:09"), for a surface that picks by width. */
  compact: string;
  /** Present for the tiled shape. */
  tiles?: readonly [CountdownTile, CountdownTile];
  /** The time to the minute in words, for screen readers. */
  spoken: string;
  tone: TimeLeftTone;
  /** "Time left", "Closing soon" or "Final minutes". */
  label: string;
  /** Milliseconds until `text`, `tone` or `label` can change. Always at least 1. */
  nextChangeInMs: number;
};

export type CountdownDisplay =
  /** Beyond the count range: the caller prints the date. */
  | { kind: "date"; nextChangeInMs: number }
  /** The surface keeps its own text until the count starts. */
  | { kind: "static"; nextChangeInMs: number }
  | CountingDisplay
  /** Zero reached, result not yet confirmed. */
  | { kind: "closing" }
  /** No usable time (not a number). */
  | { kind: "none" };

/** How often the printed words can change, by shape and time left. */
function granularityMs(shape: CountdownShape, msLeft: number, secondsBelowMs: number): number {
  if (shape === "clock") return SECOND_MS;
  if (msLeft < secondsBelowMs) return SECOND_MS;
  if (msLeft >= DAY_MS) return HOUR_MS;
  // Hours and minutes (or minutes alone) change by the minute; a chip's hour form too.
  return MINUTE_MS;
}

/** Milliseconds until the whole-second figure drops into the next step of size `stepMs`. */
function untilNextStep(msLeft: number, stepMs: number): number {
  const floor = Math.floor(msLeft / stepMs) * stepMs;
  return Math.max(1, msLeft - floor + 1);
}

/** Milliseconds until the time left falls below `thresholdMs`, or null if it already has. */
function untilBelow(msLeft: number, thresholdMs: number): number | null {
  return msLeft >= thresholdMs ? msLeft - thresholdMs + 1 : null;
}

function earliest(...candidates: (number | null)[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const value of candidates) if (value !== null && value < best) best = value;
  return Math.max(1, best);
}

function textFor(shape: CountdownShape, msLeft: number, showSeconds: boolean): string {
  switch (shape) {
    case "words":
      return formatTimeLeft(msLeft, { showSeconds });
    case "compact":
      return formatCountdownCompact(msLeft);
    case "clock":
      return formatCountdownClock(msLeft);
    case "tiles": {
      const [first, second] = countdownTiles(msLeft);
      return `${first.value} ${first.unit} ${second.value} ${second.unit}`;
    }
  }
}

/**
 * What a surface shows for the time left: a date, its own static text, a count, or "closing". A
 * pure function of the surface, the time left and the context; the shared clock calls it and
 * wakes again after `nextChangeInMs`.
 */
export function countdownDisplay(
  surface: CountdownSurface,
  msLeft: number,
  ctx: CountdownContext = {},
): CountdownDisplay {
  if (!Number.isFinite(msLeft)) return { kind: "none" };
  if (msLeft <= 0) return { kind: "closing" };
  const rule = COUNTDOWN_SURFACES[surface];

  if (rule.dateBeyondMs !== null && msLeft > rule.dateBeyondMs) {
    return { kind: "date", nextChangeInMs: earliest(msLeft - rule.dateBeyondMs) };
  }
  if (rule.countsOnlyWithSeconds && msLeft >= rule.secondsBelowMs) {
    return { kind: "static", nextChangeInMs: earliest(untilBelow(msLeft, rule.secondsBelowMs)) };
  }

  const showSeconds = msLeft < rule.secondsBelowMs;
  const band = timeLeftBand(msLeft, ctx.extended === undefined ? {} : { extended: ctx.extended });
  const text = textFor(rule.shape, msLeft, showSeconds);
  const step = granularityMs(rule.shape, msLeft, rule.secondsBelowMs);
  const nextChangeInMs = earliest(
    untilNextStep(msLeft, step),
    untilBelow(msLeft, rule.secondsBelowMs),
    untilBelow(msLeft, HOUR_MS),
    untilBelow(msLeft, 2 * MINUTE_MS),
  );

  const display: CountingDisplay = {
    kind: "counting",
    text,
    compact: formatCountdownCompact(msLeft),
    spoken: formatCountdownSpoken(msLeft),
    tone: band.tone,
    label: band.label,
    nextChangeInMs,
  };
  if (rule.shape === "tiles") display.tiles = countdownTiles(msLeft);
  return display;
}
