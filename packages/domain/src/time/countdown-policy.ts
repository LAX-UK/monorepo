import {
  TIME_LEFT_DATE_BEYOND_MS,
  type TimeLeftTone,
  formatTimeLeft,
  timeLeftBand,
  wholeSecondsLeft,
} from "../lot-page/time-left.js";
import {
  type CountdownTile,
  countdownTiles,
  formatCountdownClock,
  formatCountdownCompact,
  formatCountdownSpoken,
  formatCountdownUnits,
} from "./countdown-format.js";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Every place a countdown is shown. A new place is a new row in {@link COUNTDOWN_SURFACES}. */
export type CountdownSurface = "lot" | "lotBar" | "card" | "chip" | "saleHero" | "cover";

/** The wording a surface prints. */
export type CountdownShape = "units" | "words" | "compact" | "tiles" | "clock";

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
 * One row per surface. The lot page and its phone bar count seconds for the whole week; every
 * other surface counts by the minute until the final hour. Changing a surface is changing its row.
 */
export const COUNTDOWN_SURFACES: Readonly<Record<CountdownSurface, SurfaceRule>> = {
  // Seconds from the moment counting starts (seven days exactly) down, so the limit is one second
  // past the date threshold.
  lot: {
    secondsBelowMs: TIME_LEFT_DATE_BEYOND_MS + SECOND_MS,
    shape: "units",
    dateBeyondMs: TIME_LEFT_DATE_BEYOND_MS,
  },
  lotBar: {
    secondsBelowMs: TIME_LEFT_DATE_BEYOND_MS + SECOND_MS,
    shape: "units",
    dateBeyondMs: TIME_LEFT_DATE_BEYOND_MS,
  },
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
  /** The lot is in a soft-close extension: always the tightest tone, labelled "Extended". */
  extended?: boolean;
  /**
   * The visitor asked for less motion: the lot page changes once a minute until the final hour,
   * then counts seconds. Other surfaces already do.
   */
  reducedMotion?: boolean;
};

export type CountingDisplay = {
  kind: "counting";
  /** The surface's own wording: units, words, the compact form, the clock, or the tiles' pair. */
  text: string;
  /** The least-width form ("2d 14h", "42:09"), for a surface that picks by width. */
  compact: string;
  /** Present for the tiled shape. */
  tiles?: readonly [CountdownTile, CountdownTile];
  /** The time to the minute in words, for screen readers. */
  spoken: string;
  tone: TimeLeftTone;
  /** "Time left", "Closing soon", "Final minutes" or "Extended". */
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

/** The row for a surface, with reduced motion taken into account. */
function ruleFor(surface: CountdownSurface, ctx: CountdownContext): SurfaceRule {
  const rule = COUNTDOWN_SURFACES[surface];
  if (ctx.reducedMotion && rule.secondsBelowMs > HOUR_MS) {
    return { ...rule, secondsBelowMs: HOUR_MS };
  }
  return rule;
}

/** The step, in whole seconds, between changes of the printed words. */
function stepSeconds(shape: CountdownShape, totalSeconds: number, secondsBelowMs: number): number {
  if (shape === "clock") return 1;
  if (totalSeconds * SECOND_MS < secondsBelowMs) return 1;
  if (shape === "units") return 60;
  if (totalSeconds >= DAY_MS / SECOND_MS) return HOUR_MS / SECOND_MS;
  // Hours and minutes (or minutes alone) change by the minute; a chip's hour form too.
  return MINUTE_MS / SECOND_MS;
}

/**
 * Milliseconds until the rounded-up whole second drops to the step boundary below the current
 * step (the moment the printed words change).
 */
function untilNextStep(msLeft: number, stepSec: number): number {
  const total = wholeSecondsLeft(msLeft);
  const boundary = Math.floor(total / stepSec) * stepSec;
  return Math.max(1, msLeft - (boundary - 1) * SECOND_MS);
}

/**
 * Milliseconds until the rounded-up second reaches `limitSeconds`, or null if it is already at or
 * below it. Used for the thresholds that change the tone or the shape.
 */
function untilSecondsAtOrBelow(msLeft: number, limitSeconds: number): number | null {
  const limitMs = limitSeconds * SECOND_MS;
  return msLeft > limitMs ? msLeft - limitMs : null;
}

function earliest(...candidates: (number | null)[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const value of candidates) if (value !== null && value < best) best = value;
  return Math.max(1, best);
}

function textFor(shape: CountdownShape, msLeft: number, showSeconds: boolean): string {
  switch (shape) {
    case "units":
      return formatCountdownUnits(msLeft, { seconds: showSeconds });
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
 * wakes again after `nextChangeInMs`. Time is read in whole seconds, rounded up, so the text, the
 * tone and the wake time always agree about which second it is.
 */
export function countdownDisplay(
  surface: CountdownSurface,
  msLeft: number,
  ctx: CountdownContext = {},
): CountdownDisplay {
  if (!Number.isFinite(msLeft)) return { kind: "none" };
  if (msLeft <= 0) return { kind: "closing" };
  const rule = ruleFor(surface, ctx);
  const total = wholeSecondsLeft(msLeft);
  const roundedMs = total * SECOND_MS;

  if (rule.dateBeyondMs !== null && roundedMs > rule.dateBeyondMs) {
    return {
      kind: "date",
      nextChangeInMs: earliest(untilSecondsAtOrBelow(msLeft, rule.dateBeyondMs / SECOND_MS)),
    };
  }
  if (rule.countsOnlyWithSeconds && roundedMs >= rule.secondsBelowMs) {
    return {
      kind: "static",
      nextChangeInMs: earliest(untilSecondsAtOrBelow(msLeft, rule.secondsBelowMs / SECOND_MS - 1)),
    };
  }

  const showSeconds = roundedMs < rule.secondsBelowMs;
  const band = timeLeftBand(msLeft, ctx.extended === undefined ? {} : { extended: ctx.extended });
  const text = textFor(rule.shape, msLeft, showSeconds);
  const step = stepSeconds(rule.shape, total, rule.secondsBelowMs);
  const nextChangeInMs = earliest(
    untilNextStep(msLeft, step),
    // Seconds start (or stop) when the rounded second reaches the surface's threshold.
    untilSecondsAtOrBelow(msLeft, rule.secondsBelowMs / SECOND_MS - 1),
    untilSecondsAtOrBelow(msLeft, HOUR_MS / SECOND_MS - 1),
    untilSecondsAtOrBelow(msLeft, (2 * MINUTE_MS) / SECOND_MS - 1),
  );

  const display: CountingDisplay = {
    kind: "counting",
    text,
    compact: rule.shape === "units" ? text : formatCountdownCompact(msLeft),
    spoken: formatCountdownSpoken(msLeft),
    tone: band.tone,
    label: band.label,
    nextChangeInMs,
  };
  if (rule.shape === "tiles") display.tiles = countdownTiles(msLeft);
  return display;
}
