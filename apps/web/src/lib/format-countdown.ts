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

/** Human-friendly countdown: under 24h → `HH:MM:SS`; otherwise `ND` + same-day `HH:MM:SS` (avoids `454:09:15`).
 */
export function formatCountdownForDisplay(ms: number): string {
  if (ms <= 0) return formatCountdownClock(0);
  if (ms < MS_PER_DAY) return formatCountdownClock(ms);
  const days = Math.floor(ms / MS_PER_DAY);
  const remainder = ms % MS_PER_DAY;
  return `${days}D ${formatCountdownClock(remainder)}`;
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
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
  return `Closes in ${parts.join(", ")}`;
}
