import type { EmailOutboxStatus, EmailStream, EmailSuppressionReason } from "@auction/db/schema";

export type EmailOutboxRow = {
  id: string;
  status: EmailOutboxStatus;
  attempts: number;
  toEmailHash: string;
  toSnapshot: string | null;
  userId: string | null;
  template: string;
  vars: unknown;
  stream: EmailStream;
  flaggedAddress: boolean;
  category: string;
};

/** Result of a send claim: `claimed` is true only when this caller moved pending → sending. */
export type EmailOutboxClaimResult = {
  row: EmailOutboxRow;
  claimed: boolean;
};

export interface IEmailOutboxRepository {
  claimForSend(outboxId: string): Promise<EmailOutboxClaimResult | null>;
  findSuppression(emailHash: string): Promise<boolean>;
  markSuppressed(outboxId: string, reason: string): Promise<void>;
  markSent(outboxId: string, messageId: string): Promise<void>;
  markFailedOrPending(outboxId: string, message: string, terminal: boolean): Promise<void>;
  resolveUserEmail(userId: string): Promise<string | null>;
  insertSuppression(emailHash: string, reason: EmailSuppressionReason): Promise<void>;
  findStalePendingIds(): Promise<Array<{ id: string }>>;
}
