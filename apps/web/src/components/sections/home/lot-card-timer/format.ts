import { formatCountdownClock } from "@/lib/format-countdown";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Remaining duration for pill display: under 24h uses HH:MM:SS; otherwise `Nd HH:MM:SS`. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return formatCountdownClock(0);
  if (ms < MS_PER_DAY) return formatCountdownClock(ms);
  const days = Math.floor(ms / MS_PER_DAY);
  const remainder = ms % MS_PER_DAY;
  return `${days}d ${formatCountdownClock(remainder)}`;
}
