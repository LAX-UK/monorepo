import type { Database } from "@auction/db";
import type { EmailSuppressionReason } from "@auction/db/schema";
import { emailSuppression } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IEmailSuppressionRepository } from "../interfaces/email-suppression.repository.js";

export class DrizzleEmailSuppressionRepository implements IEmailSuppressionRepository {
  constructor(private readonly db: Database) {}

  async upsert(emailHash: string, reason: EmailSuppressionReason): Promise<void> {
    await this.db
      .insert(emailSuppression)
      .values({ emailHash, reason })
      .onConflictDoUpdate({
        target: emailSuppression.emailHash,
        // Postmark's report replaces whatever was there, so it is no longer labelled Campaigns.
        set: { reason, source: null, createdAt: new Date() },
      });
  }

  async liftMarketingOptOut(emailHash: string): Promise<boolean> {
    const removed = await this.db
      .delete(emailSuppression)
      .where(
        and(
          eq(emailSuppression.emailHash, emailHash),
          eq(emailSuppression.reason, "unsubscribed_marketing"),
          eq(emailSuppression.source, "zoho_campaigns"),
        ),
      )
      .returning({ emailHash: emailSuppression.emailHash });
    return removed.length > 0;
  }
}
