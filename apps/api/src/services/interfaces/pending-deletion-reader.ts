/**
 * Whether a person has asked to delete their account, as Bid learned it from Identity's
 * `user.deletion_requested` and `user.deletion_cancelled` events.
 */
export interface IPendingDeletionReader {
  /** When the person asked to delete their account; null when no request stands. */
  requestedAt(userId: string): Promise<Date | null>;
}
