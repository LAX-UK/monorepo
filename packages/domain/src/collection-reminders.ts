import { BUSINESS_TIME_ZONE } from "./calendar-year.js";
import { addDaysToKey, dateKeyParts, londonDateKey } from "./collection-time.js";
import { zonedInstant } from "./working-hours.js";

/** London wall-clock time the day-before reminders go out, in minutes after midnight (09:00). */
export const COLLECTION_REMINDER_MINUTE = 9 * 60;

export type ReminderWindow = {
  /** Visits starting from this instant (the start of tomorrow, London time)... */
  from: Date;
  /** ...up to, not including, this one (the start of the day after). */
  to: Date;
  /**
   * Only visits booked before this instant get a reminder: a visit booked after this morning's
   * 09:00 for tomorrow has just had its confirmation.
   */
  bookedBefore: Date;
};

const startOfLondonDay = (key: string): Date =>
  zonedInstant(dateKeyParts(key), 0, BUSINESS_TIME_ZONE);

/**
 * Which visits are due a reminder when the sweep runs at `now`: tomorrow's, once it is 09:00 in
 * London, and not before. The sweep can run as often as it likes. The answer for a given London
 * day is the same all day, and each reminder carries a key made from the visit, so one that was
 * already sent is never sent again. Works across the clock changes: the day is the London one.
 */
export function reminderWindow(now: Date): ReminderWindow | null {
  const today = londonDateKey(now);
  const nineToday = zonedInstant(
    dateKeyParts(today),
    COLLECTION_REMINDER_MINUTE,
    BUSINESS_TIME_ZONE,
  );
  if (now.getTime() < nineToday.getTime()) return null;
  const tomorrow = addDaysToKey(today, 1);
  return {
    from: startOfLondonDay(tomorrow),
    to: startOfLondonDay(addDaysToKey(tomorrow, 1)),
    bookedBefore: nineToday,
  };
}
