import type { Database } from "@auction/db";
import {
  type EmailSuppressionReason,
  emailSuppression,
  zohoCampaignsSuppressionState,
} from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  IZohoCampaignsSuppressionRepository,
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

  async suppress(emailHash: string, reason: EmailSuppressionReason): Promise<boolean> {
    const changed = await this.db
      .insert(emailSuppression)
      .values({ emailHash, reason, source: "zoho_campaigns" })
      .onConflictDoUpdate({
        target: emailSuppression.emailHash,
        set: { reason, source: "zoho_campaigns", createdAt: new Date() },
        setWhere: sql`${reasonRank(sql`${emailSuppression.reason}`)} < ${reasonRank(sql`excluded.reason`)}`,
      })
      .returning({ emailHash: emailSuppression.emailHash });
    return changed.length > 0;
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
