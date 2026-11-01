import { type CountdownTier, countdownTier } from "@/lib/format-countdown";

/**
 * How loud a countdown is. Calm ink while there is time; the warning tone in the final hour; the
 * danger tone in the final minutes or while a closing time is extended. Red is kept for the
 * moments that need action, so a sale closing in two days never reads as an alarm.
 *
 * Binding point for the lot domain: when its time-left tone table lands, map that table's tones
 * onto `CountdownTone` here and drop `countdownToneForRemaining`; the classes below stay.
 */
export type CountdownTone = "calm" | "soon" | "urgent";

const TONE_BY_TIER: Readonly<Record<CountdownTier, CountdownTone>> = {
  normal: "calm",
  urgent: "soon",
  critical: "urgent",
};

/** The tone for a countdown tier from `countdownTier`. */
export function countdownToneForTier(tier: CountdownTier): CountdownTone {
  return TONE_BY_TIER[tier];
}

/** The tone for the time left; an extension is always urgent. */
export function countdownToneForRemaining(
  msLeft: number,
  options: { extended?: boolean } = {},
): CountdownTone {
  if (options.extended) return "urgent";
  return countdownToneForTier(countdownTier(msLeft));
}

/** Digit colour per tone, from the `--color-countdown-*` tokens in globals.css. */
export const COUNTDOWN_TONE_TEXT_CLASS: Readonly<Record<CountdownTone, string>> = {
  calm: "text-countdown-calm",
  soon: "text-countdown-soon",
  urgent: "text-countdown-urgent",
};

/** A tinted strip around a countdown (the lot page's closing row): neutral until the last hour. */
export const COUNTDOWN_TONE_SURFACE_CLASS: Readonly<Record<CountdownTone, string>> = {
  calm: "border-outline-variant/40 bg-surface-container-low",
  soon: "border-transparent bg-warning-container",
  urgent: "border-transparent bg-danger-container",
};

export function countdownToneClass(tone: CountdownTone): string {
  return COUNTDOWN_TONE_TEXT_CLASS[tone];
}
