/** HH:MM:SS style countdown for active lots. */
export function formatCountdownClock(msRemaining: number): string {
  if (msRemaining <= 0) return "00:00:00";
  const s = Math.floor(msRemaining / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}
