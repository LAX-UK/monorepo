/**
 * Whether a person has asked to delete their account, as Shop learned it from Identity's
 * `user.deletion_requested` and `user.deletion_cancelled` events.
 */
export interface PendingDeletionReader {
  /** When the person asked to delete their account; null when no request stands. */
  requestedAt(identitySubjectId: string): Promise<Date | null>;
}
