/** The final hour counts in minutes and seconds. */
export function formatCoverClock(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Fills the template's `{time}` with the clock for the time left. */
export function coverTickText(template: string, msLeft: number): string {
  return template.replace("{time}", formatCoverClock(msLeft));
}
