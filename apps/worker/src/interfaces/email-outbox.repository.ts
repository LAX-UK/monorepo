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

export type EmailOutboxClaimResult = {
  row: EmailOutboxRow;
  claimed: boolean;
};

export type EmailOutboxRecoveryRow = {
  id: string;
  /** BullMQ job id suffix; matches outbox attempts after recovery claim. */
  dispatchGeneration: number;
};

export interface IEmailOutboxRepository {
  claimForSend(outboxId: string): Promise<EmailOutboxClaimResult | null>;
  /** Why this address is suppressed, or null when it is not. */
  findSuppression(emailHash: string): Promise<EmailSuppressionReason | null>;
  markSuppressed(outboxId: string, reason: string): Promise<void>;
  /** `discardSnapshot` also erases the stored recipient address, which is no longer needed. */
  markSent(
    outboxId: string,
    messageId: string,
    options?: { discardSnapshot: boolean },
  ): Promise<void>;
  markFailedOrPending(outboxId: string, message: string, terminal: boolean): Promise<void>;
  markSentPersistenceFailed(outboxId: string, messageId: string, message: string): Promise<void>;
  resolveUserEmail(userId: string): Promise<string | null>;
  insertSuppression(emailHash: string, reason: EmailSuppressionReason): Promise<void>;
  recoverStaleForDispatch(): Promise<EmailOutboxRecoveryRow[]>;
}
