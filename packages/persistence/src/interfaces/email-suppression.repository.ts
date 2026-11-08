import type { EmailSuppressionReason } from "@auction/db/schema";

export interface IEmailSuppressionRepository {
  upsert(emailHash: string, reason: EmailSuppressionReason): Promise<void>;
  /**
   * Removes a marketing opt-out copied from Zoho Campaigns, for a person who has since asked for
   * alerts, and records the lift at `at` so the sync does not bring the same opt-out back. Any
   * other entry (bounce, complaint, unsubscribe, manual) is left alone.
   * Returns true when an entry was removed.
   */
  liftMarketingOptOut(emailHash: string, at: Date): Promise<boolean>;
}
