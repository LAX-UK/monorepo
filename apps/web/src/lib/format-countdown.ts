const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** HH:MM:SS for the clock face; only the remainder within 24h when used inside {@link formatCountdownForDisplay}. */
export function formatCountdownClock(msRemaining: number): string {
  if (msRemaining <= 0) return "00:00:00";
  const s = Math.floor(msRemaining / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Human-friendly countdown: under 24h → `HH:MM:SS`; otherwise `Nd` + same-day `HH:MM:SS` (avoids `454:09:15`).
 */
export function formatCountdownForDisplay(ms: number): string {
  if (ms <= 0) return formatCountdownClock(0);
  if (ms < MS_PER_DAY) return formatCountdownClock(ms);
  const days = Math.floor(ms / MS_PER_DAY);
  const remainder = ms % MS_PER_DAY;
  return `${days}d ${formatCountdownClock(remainder)}`;
}
