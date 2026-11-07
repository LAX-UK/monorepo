import { type Database, liftZohoCampaignsOptOut } from "@auction/db";
import {
  type EmailSuppressionReason,
  emailSuppression,
  zohoCampaignsOptOutLift,
  zohoCampaignsSuppressionState,
} from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  IZohoCampaignsSuppressionRepository,
  SuppressOutcome,
  ZohoCampaignsSuppressionMode,
} from "../interfaces/zoho-campaigns-suppression.repository.js";

/** How broad an entry is: a marketing opt-out, then an unsubscribe, then every kind of block. */
const reasonRank = (column: unknown) => sql`CASE ${column}
  WHEN 'unsubscribed_marketing' THEN 1
  WHEN 'unsubscribe' THEN 2
  ELSE 3 END`;

export class DrizzleZohoCampaignsSuppressionRepository
  implements IZohoCampaignsSuppressionRepository
{
  constructor(private readonly db: Database) {}

  async suppress(
    emailHash: string,
    reason: EmailSuppressionReason,
    occurredAt: Date | null,
  ): Promise<SuppressOutcome> {
    return this.db.transaction(async (tx) => {
      // The same lock the lift function takes, so a lift and a sync pass for one address queue up.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${emailHash}))`);
      if (reason === "unsubscribed_marketing") {
        const [lift] = await tx
          .select({ liftedAt: zohoCampaignsOptOutLift.liftedAt })
          .from(zohoCampaignsOptOutLift)
          .where(eq(zohoCampaignsOptOutLift.emailHash, emailHash))
          .limit(1);
        if (lift && (!occurredAt || occurredAt.getTime() <= lift.liftedAt.getTime())) {
          return "lifted";
        }
      }
      // An unsubscribe with no readable time is stored as epoch: it counts as old, so a later
      // re-subscribe (which lifts only an opt-out older than the subscribe time) can lift it.
      const at = occurredAt ?? (reason === "unsubscribed_marketing" ? new Date(0) : new Date());
      const changed = await tx
        .insert(emailSuppression)
        .values({ emailHash, reason, source: "zoho_campaigns", createdAt: at })
        .onConflictDoUpdate({
          target: emailSuppression.emailHash,
          set: { reason, source: "zoho_campaigns", createdAt: at },
          setWhere: sql`${reasonRank(sql`${emailSuppression.reason}`)} < ${reasonRank(sql`excluded.reason`)}`,
        })
        .returning({ emailHash: emailSuppression.emailHash });
      return changed.length > 0 ? "applied" : "unchanged";
    });
  }

  async liftOptOut(
    emailHash: string,
    at: Date,
    options: { onlyIfOlder?: boolean } = {},
  ): Promise<boolean> {
    return liftZohoCampaignsOptOut(this.db, emailHash, at, options);
  }

  async getWatermark(mode: ZohoCampaignsSuppressionMode): Promise<Date | null> {
    const [row] = await this.db
      .select({ watermark: zohoCampaignsSuppressionState.watermark })
      .from(zohoCampaignsSuppressionState)
      .where(eq(zohoCampaignsSuppressionState.mode, mode))
      .limit(1);
    return row?.watermark ?? null;
  }

  async advanceWatermark(mode: ZohoCampaignsSuppressionMode, to: Date, now: Date): Promise<void> {
    await this.db
      .insert(zohoCampaignsSuppressionState)
      .values({ mode, watermark: to, updatedAt: now })
      .onConflictDoUpdate({
        target: zohoCampaignsSuppressionState.mode,
        set: {
          watermark: sql`GREATEST(${zohoCampaignsSuppressionState.watermark}, excluded.watermark)`,
          updatedAt: now,
        },
      });
  }
}
