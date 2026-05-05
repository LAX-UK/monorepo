import type { EmailEventType, EmailOutboxStatus, EmailSuppressionReason } from "@auction/db/schema";

export type EmailOutboxRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  toEmailHash: string;
  template: string;
  status: EmailOutboxStatus;
  messageId: string | null;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

export type EmailEventRow = {
  id: string;
  messageId: string | null;
  type: EmailEventType;
  provider: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
};

export type EmailSuppressionRow = {
  emailHash: string;
  reason: EmailSuppressionReason;
  createdAt: Date;
};

export interface IEmailObservabilityRepository {
  listOutbox(input: {
    status?: EmailOutboxStatus;
    limit: number;
    offset: number;
  }): Promise<EmailOutboxRow[]>;
  listEvents(input: { messageId: string }): Promise<EmailEventRow[]>;
  listSuppressions(input: { limit: number; offset: number }): Promise<EmailSuppressionRow[]>;
  deleteSuppression(input: { emailHash: string }): Promise<void>;
}
