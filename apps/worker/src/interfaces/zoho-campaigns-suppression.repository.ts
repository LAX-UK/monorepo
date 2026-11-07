import type { EmailSuppressionReason } from "@auction/db/schema";

export type ZohoCampaignsSuppressionMode = "dry_run" | "live";

/** What the Zoho Campaigns suppression sync keeps: the suppression entries and its watermark. */
export interface IZohoCampaignsSuppressionRepository {
  /**
   * Records a suppression reported by Zoho Campaigns. An existing entry is only replaced by a
   * broader one (marketing opt-out < unsubscribe < bounce, complaint or manual block), so a
   * repeat is a no-op and a marketing opt-out can never narrow an existing block.
   * Returns true when the table changed.
   */
  suppress(emailHash: string, reason: EmailSuppressionReason): Promise<boolean>;
  getWatermark(mode: ZohoCampaignsSuppressionMode): Promise<Date | null>;
  /** Moves the watermark forward only; an earlier time is ignored. */
  advanceWatermark(mode: ZohoCampaignsSuppressionMode, to: Date, now: Date): Promise<void>;
}
