import type { UserNotification } from "@auction/types";

export type CreateNotificationRow = {
  userId: string;
  type: string;
  title: string;
  message: string;
  lotId?: string | undefined;
  submissionId?: string | undefined;
  /** Ephemeral fields for email/push channels (not stored on `notification` rows). */
  meta?: {
    paymentId?: string;
    amount?: string;
    invoiceUrl?: string | null;
    invoiceNumber?: string;
    lotTitle?: string;
    outboxIdempotencyKey?: string;
  };
};

export interface INotificationWriteRepository {
  createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]>;
}
