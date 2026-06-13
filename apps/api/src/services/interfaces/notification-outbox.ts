import type { Database } from "@auction/db";
import type { NotificationPayload } from "./notification-channel.js";

export type NotificationOutboxRow = {
  id: string;
  idempotencyKey: string;
  userId: string;
  payload: NotificationPayload;
  state: "pending" | "claimed" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  processedAt: Date | null;
  claimedAt: Date | null;
};

export type StageNotificationOutboxInput = {
  userId: string;
  payload: NotificationPayload;
  idempotencyKey: string;
};

export interface INotificationOutboxRepository {
  stage(input: StageNotificationOutboxInput, tx?: Database): Promise<boolean>;
  claim(batchSize: number): Promise<NotificationOutboxRow[]>;
  ack(ids: string[]): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  countPending(): Promise<number>;
}

export interface INotificationOutboxService {
  stageDispatch(input: StageNotificationOutboxInput, tx?: Database): Promise<void>;
}

export interface INotificationOutboxProcessor {
  processBatch(batchSize?: number): Promise<{
    processed: number;
    failed: number;
    pendingDepth: number;
  }>;
}
