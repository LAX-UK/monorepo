import type { Database } from "@auction/db";
import { emailEvent, emailOutbox, emailSuppression, user } from "@auction/db/schema";
import { desc, eq } from "drizzle-orm";
import type {
  EmailEventRow,
  EmailOutboxRow,
  EmailSuppressionRow,
  IEmailObservabilityRepository,
} from "../services/interfaces/email-observability.js";

export class DrizzleEmailObservabilityRepository implements IEmailObservabilityRepository {
  constructor(private readonly db: Database) {}

  async listOutbox(input: Parameters<IEmailObservabilityRepository["listOutbox"]>[0]) {
    const rows = await this.db
      .select({
        id: emailOutbox.id,
        userId: emailOutbox.userId,
        userEmail: user.email,
        toEmailHash: emailOutbox.toEmailHash,
        template: emailOutbox.template,
        status: emailOutbox.status,
        messageId: emailOutbox.messageId,
        lastError: emailOutbox.lastError,
        createdAt: emailOutbox.createdAt,
        sentAt: emailOutbox.sentAt,
      })
      .from(emailOutbox)
      .leftJoin(user, eq(emailOutbox.userId, user.id))
      .where(input.status ? eq(emailOutbox.status, input.status) : undefined)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(input.limit)
      .offset(input.offset);
    return rows satisfies EmailOutboxRow[];
  }

  async listEvents(input: { messageId: string }): Promise<EmailEventRow[]> {
    return this.db
      .select({
        id: emailEvent.id,
        messageId: emailEvent.messageId,
        type: emailEvent.type,
        provider: emailEvent.provider,
        payload: emailEvent.payload,
        receivedAt: emailEvent.receivedAt,
      })
      .from(emailEvent)
      .where(eq(emailEvent.messageId, input.messageId))
      .orderBy(desc(emailEvent.receivedAt));
  }

  async listSuppressions(input: { limit: number; offset: number }): Promise<EmailSuppressionRow[]> {
    return this.db
      .select({
        emailHash: emailSuppression.emailHash,
        reason: emailSuppression.reason,
        createdAt: emailSuppression.createdAt,
      })
      .from(emailSuppression)
      .orderBy(desc(emailSuppression.createdAt))
      .limit(input.limit)
      .offset(input.offset);
  }

  async deleteSuppression(input: { emailHash: string }): Promise<void> {
    await this.db.delete(emailSuppression).where(eq(emailSuppression.emailHash, input.emailHash));
  }
}
