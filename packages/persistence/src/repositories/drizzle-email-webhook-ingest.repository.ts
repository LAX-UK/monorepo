import type { Database } from "@auction/db";
import type { EmailEventType } from "@auction/db/schema";
import { bidIdentityDirectory, emailEvent, emailOutbox } from "@auction/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type { IEmailWebhookIngestRepository } from "../interfaces/email-webhook-ingest.repository.js";
import {
  activeIdentitySubject,
  normalizedIdentityEmailEquals,
} from "../lib/bid-identity-directory-query.js";

export class DrizzleEmailWebhookIngestRepository implements IEmailWebhookIngestRepository {
  constructor(private readonly db: Database) {}

  async insertEmailEvent(input: {
    messageId: string | null;
    type: EmailEventType;
    provider: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(emailEvent).values({
      messageId: input.messageId,
      type: input.type,
      provider: input.provider,
      payload: input.payload,
    });
  }

  async findOutboxByMessageId(messageId: string) {
    const [row] = await this.db
      .select({
        id: emailOutbox.id,
        userId: emailOutbox.userId,
        toEmailHash: emailOutbox.toEmailHash,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.messageId, messageId))
      .limit(1);
    return row ?? null;
  }

  async countSoftBouncesForEmailSince(emailLower: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({
        n: sql<number>`count(*)::int`,
      })
      .from(emailEvent)
      .where(
        and(
          eq(emailEvent.type, "soft_bounce"),
          gt(emailEvent.receivedAt, since),
          sql`(lower(coalesce(${emailEvent.payload}->>'Email','')) = ${emailLower} OR lower(coalesce(${emailEvent.payload}->>'OriginalRecipient','')) = ${emailLower})`,
        ),
      );
    return row?.n ?? 0;
  }

  async updateUserEmailStatusByEmail(
    emailLower: string,
    status: "bounced" | "complained",
  ): Promise<void> {
    const rows = await this.db
      .select({ id: bidIdentityDirectory.subjectId })
      .from(bidIdentityDirectory)
      .where(
        and(
          normalizedIdentityEmailEquals(bidIdentityDirectory.email, emailLower),
          activeIdentitySubject(),
        ),
      );
    const changedAt = new Date();
    for (const row of rows) {
      await writeBidUserProfile(this.db, row.id, {
        emailStatus: status,
        emailStatusChangedAt: changedAt,
      });
    }
  }

  async updateUserEmailStatusByUserId(
    userId: string,
    status: "bounced" | "complained",
  ): Promise<void> {
    await writeBidUserProfile(this.db, userId, {
      emailStatus: status,
      emailStatusChangedAt: new Date(),
    });
  }
}
