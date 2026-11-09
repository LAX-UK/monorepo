import type { CollectionNoticeVisit } from "../services/collection-notices.js";

/** A booked visit that is due its day-before reminder. */
export type RemindableVisit = { bookingId: string };

/** What the collection emails read: the visit, the people around it, and which visits are due. */
export interface ICollectionNoticeReader {
  /** The visit as it is now; null when it no longer exists. */
  visit(bookingId: string): Promise<CollectionNoticeVisit | null>;
  /**
   * Booked visits that start between `from` and `to` and were booked before `bookedBefore`: the
   * next London day's visits, minus any made after the morning's reminders were due (those just
   * had their confirmation).
   */
  dueReminders(window: { from: Date; to: Date; bookedBefore: Date }): Promise<RemindableVisit[]>;
}
