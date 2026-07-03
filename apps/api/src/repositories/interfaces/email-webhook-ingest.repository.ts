import type { EmailEventType } from "@auction/db/schema";

export interface IEmailWebhookIngestRepository {
  insertEmailEvent(input: {
    messageId: string | null;
    type: EmailEventType;
    provider: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  findOutboxByMessageId(messageId: string): Promise<{
    id: string;
    userId: string | null;
    toEmailHash: string;
  } | null>;
  countSoftBouncesForEmailSince(emailLower: string, since: Date): Promise<number>;
  updateUserEmailStatusByEmail(emailLower: string, status: "bounced" | "complained"): Promise<void>;
  updateUserEmailStatusByUserId(userId: string, status: "bounced" | "complained"): Promise<void>;
}
