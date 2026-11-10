import { formatCountdownClock } from "@auction/domain";

/** The final hour counts in minutes and seconds. */
export function formatCoverClock(msLeft: number): string {
  return formatCountdownClock(msLeft);
}

/** Fills the template's `{time}` with the clock for the time left. */
export function coverTickText(template: string, msLeft: number): string {
  return template.replace("{time}", formatCoverClock(msLeft));
}
