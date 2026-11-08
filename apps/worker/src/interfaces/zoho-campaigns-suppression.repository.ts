import type { EmailSuppressionReason } from "@auction/db/schema";

export type ZohoCampaignsSuppressionMode = "dry_run" | "live";

/**
 * Lifts a Zoho Campaigns marketing opt-out because the person asked for mail again, and records
 * when, so the daily sync does not bring the same opt-out back. Only that kind of entry is ever
 * removed: bounces, complaints and manual blocks are left alone.
 */
export interface IZohoCampaignsOptOutLiftRepository {
  /**
   * `onlyIfOlder` (the Campaigns re-subscribe path) lifts only when such an opt-out exists and
   * predates `at`; without it the lift is recorded even if there is no entry yet.
   * Returns true when an entry was removed.
   */
  liftOptOut(emailHash: string, at: Date, options?: { onlyIfOlder?: boolean }): Promise<boolean>;
}

/**
 * - applied: the table changed.
 * - unchanged: an existing entry was as broad or broader.
 * - lifted: a marketing opt-out at or before the person's last lift, so it was not recorded.
 */
export type SuppressOutcome = "applied" | "unchanged" | "lifted";

/** What the Zoho Campaigns suppression sync keeps: the suppression entries and its watermark. */
export interface IZohoCampaignsSuppressionRepository extends IZohoCampaignsOptOutLiftRepository {
  /**
   * Records a suppression reported by Zoho Campaigns, dated `occurredAt` (now when Zoho gave no
   * time). An existing entry is only replaced by a broader one (marketing opt-out < unsubscribe <
   * bounce, complaint or manual block), so a repeat is a no-op and a marketing opt-out can never
   * narrow an existing block. A marketing opt-out at or before the person's last lift is skipped,
   * and so is one with no readable time when a lift exists: it cannot be shown to be newer. A
   * newer unsubscribe applies again. Bounces are never held back by a lift.
   */
  suppress(
    emailHash: string,
    reason: EmailSuppressionReason,
    occurredAt: Date | null,
  ): Promise<SuppressOutcome>;
  getWatermark(mode: ZohoCampaignsSuppressionMode): Promise<Date | null>;
  /** Moves the watermark forward only; an earlier time is ignored. */
  advanceWatermark(mode: ZohoCampaignsSuppressionMode, to: Date, now: Date): Promise<void>;
}
