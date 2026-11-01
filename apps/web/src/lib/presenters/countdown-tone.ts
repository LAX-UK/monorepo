import { type TimeLeftTone, timeLeftBand } from "@auction/domain";

/**
 * How loud a countdown is, from the lot domain's time-left table (`timeLeftBand`): calm ink while
 * there is more than an hour, the warning tone in the final hour, the danger tone in the final
 * minutes and during any extension. Red is kept for the moments that need action, so a sale
 * closing in two days never reads as an alarm. The thresholds live in the domain table only.
 */
export type CountdownTone = TimeLeftTone;

/** The tone for the time left; an extension is always final. */
export function countdownTone(msLeft: number, options: { extended?: boolean } = {}): CountdownTone {
  return timeLeftBand(msLeft, options).tone;
}

/** Digit colour per tone, from the `--color-countdown-*` tokens in globals.css. */
export const COUNTDOWN_TONE_TEXT_CLASS: Readonly<Record<CountdownTone, string>> = {
  calm: "text-countdown-calm",
  soon: "text-countdown-soon",
  final: "text-countdown-final",
};

/** A tinted strip around a countdown (the lot page's closing row): neutral until the last hour. */
export const COUNTDOWN_TONE_SURFACE_CLASS: Readonly<Record<CountdownTone, string>> = {
  calm: "border-outline-variant/40 bg-surface-container-low",
  soon: "border-transparent bg-warning-container",
  final: "border-transparent bg-danger-container",
};

export function countdownToneClass(tone: CountdownTone): string {
  return COUNTDOWN_TONE_TEXT_CLASS[tone];
}
