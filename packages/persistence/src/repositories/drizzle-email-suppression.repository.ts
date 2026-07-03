import type { Database } from "@auction/db";
import type { EmailSuppressionReason } from "@auction/db/schema";
import { emailSuppression } from "@auction/db/schema";
import type { IEmailSuppressionRepository } from "../interfaces/email-suppression.repository.js";

export class DrizzleEmailSuppressionRepository implements IEmailSuppressionRepository {
  constructor(private readonly db: Database) {}

  async upsert(emailHash: string, reason: EmailSuppressionReason): Promise<void> {
    await this.db
      .insert(emailSuppression)
      .values({ emailHash, reason })
      .onConflictDoUpdate({
        target: emailSuppression.emailHash,
        set: { reason, createdAt: new Date() },
      });
  }
}
