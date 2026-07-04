import type { Database } from "@auction/db";
import type { StageNotificationOutboxInput } from "@auction/persistence/interfaces";

export type { INotificationOutboxRepository, NotificationOutboxRow, StageNotificationOutboxInput } from "@auction/persistence/interfaces";

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
