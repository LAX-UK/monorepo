/**
 * When a member was last active, as their colleagues may see it: the calendar day only, never
 * the time, so the member list shows whether someone is still around without becoming a record
 * of when they work. Days are counted in the platform's time zone, like every date the client
 * workspace shows.
 */

import { dayKey } from "@auction/datetime";

export const LAST_ACTIVE_TIME_ZONE = "Europe/London";

/** `YYYY-MM-DD` for the day `at` falls on, or `null` when it is not known. */
export function lastActiveDay(
  at: Date | null | undefined,
  timeZone: string = LAST_ACTIVE_TIME_ZONE,
): string | null {
  if (!at || Number.isNaN(at.getTime())) return null;
  return dayKey(at, timeZone);
}
