import type { Database } from "@auction/db";
import { itemSubmission } from "@auction/db/schema";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { ISellerIdentityReminderStore } from "../interfaces/seller-identity-reminder.store.js";

export class DrizzleSellerIdentityReminderStore implements ISellerIdentityReminderStore {
  constructor(private readonly db: Database) {}

  async markSent(submissionId: string, sentAt: Date, notSentSince: Date): Promise<boolean> {
    const updated = await this.db
      .update(itemSubmission)
      .set({ identityReminderSentAt: sentAt })
      .where(
        and(
          eq(itemSubmission.id, submissionId),
          or(
            isNull(itemSubmission.identityReminderSentAt),
            lte(itemSubmission.identityReminderSentAt, notSentSince),
          ),
        ),
      )
      .returning({ id: itemSubmission.id });
    return updated.length > 0;
  }
}
