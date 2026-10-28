/** Records the "verify your identity" reminder sent to a seller from a submission. */
export interface ISellerIdentityReminderStore {
  /**
   * Marks the reminder as sent at `sentAt`, unless one was sent after `notSentSince`. Marking
   * first makes sending idempotent: of two requests at once, only one gets `true` and sends.
   */
  markSent(submissionId: string, sentAt: Date, notSentSince: Date): Promise<boolean>;
}
