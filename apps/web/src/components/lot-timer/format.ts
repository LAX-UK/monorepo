import {
  COUNTDOWN_DATE_BEYOND_MS,
  formatCountdownCompact,
  formatCountdownForDisplay,
} from "@/lib/format-countdown";
import { shortMoment } from "@/lib/time/opens-line";

export { formatCountdownForDisplay as formatRemaining } from "@/lib/format-countdown";
export {
  classifyLotTimerState,
  type LotTimerInputs,
  type LotTimerState,
} from "@/lib/lot/classify-lot-timer-state";

/** One timer value in the three shapes a surface may need. */
export type TimerText = {
  /** "2 days 14 hours", "42 minutes 10 seconds"; empty beyond a week, when `date` is set. */
  words: string;
  /** The same value in the least width: "42:09", "5h 12m". Falls back to `date` beyond a week. */
  compact: string;
  /** "Thu 12 Nov" when the moment is more than a week away, else null. */
  date: string | null;
};

/** The timer value for `msLeft` at `now`: a date beyond a week, the time left within it (S14). */
export function timerText(msLeft: number, now: number): TimerText {
  if (msLeft > COUNTDOWN_DATE_BEYOND_MS) {
    const date = shortMoment(new Date(now + msLeft), new Date(now));
    return { words: "", compact: date, date };
  }
  return {
    words: formatCountdownForDisplay(msLeft),
    compact: formatCountdownCompact(msLeft),
    date: null,
  };
}
