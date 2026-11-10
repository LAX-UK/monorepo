import type { CollectionNoticeVisit, NoticeRecipient } from "../services/collection-notices.js";

/** A booked visit that is due its day-before reminder. */
export type RemindableVisit = { bookingId: string };

/** What the collection emails read: the visit, the people around it, and which visits are due. */
export interface ICollectionNoticeReader {
  /** The visit as it is now; null when it no longer exists. */
  visit(bookingId: string): Promise<CollectionNoticeVisit | null>;
  /**
   * Booked visits that start between `from` and `to` and were last changed before `changedBefore`:
   * the next London day's visits, minus any booked or moved after the morning's reminders were due
   * (those just had their confirmation or change email).
   */
  dueReminders(window: { from: Date; to: Date; changedBefore: Date }): Promise<RemindableVisit[]>;
  /**
   * How many collection emails have been queued to this address (a hash of it, as the outbox keeps
   * it) since `since`: the notice to a named collector and the cancellation that follows it.
   */
  collectorEmailsSince(addressHash: string, since: Date): Promise<number>;
  /**
   * Who hears about an account's purchases: its owners and admins, or the person for a personal
   * one, and any of `alsoUserIds` (such as an agent who won a lot for it) who is an active member.
   */
  accountRecipients(
    legalEntityId: string,
    alsoUserIds?: readonly string[],
  ): Promise<(NoticeRecipient & { wonOnly?: boolean })[]>;
}
