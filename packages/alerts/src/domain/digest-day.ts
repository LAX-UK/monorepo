import { dayKey, instantToWallClock } from "@auction/datetime";

/** Every product sends its digest at this hour, London time. */
export const DIGEST_HOUR_LONDON = 8;
export const DIGEST_TIME_ZONE = "Europe/London";

/**
 * The London calendar day an instant falls on, as `YYYY-MM-DD`. A digest is unique per person,
 * product and this date, so the cap holds across midnight and across both clock changes: the
 * zone, not a fixed offset, decides where a day begins.
 */
export function digestDateFor(now: Date): string {
  return dayKey(now, DIGEST_TIME_ZONE);
}

/** Whether London time has reached the digest hour today. */
export function isDigestDue(now: Date): boolean {
  return Number(instantToWallClock(now, DIGEST_TIME_ZONE).time.slice(0, 2)) >= DIGEST_HOUR_LONDON;
}
