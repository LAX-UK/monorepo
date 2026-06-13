import type { Database } from "@auction/db";
import type {
  INotificationOutboxRepository,
  INotificationOutboxService,
  StageNotificationOutboxInput,
} from "./interfaces/notification-outbox.js";

export class NotificationOutboxService implements INotificationOutboxService {
  constructor(private readonly outbox: INotificationOutboxRepository) {}

  async stageDispatch(input: StageNotificationOutboxInput, tx?: Database): Promise<void> {
    await this.outbox.stage(input, tx);
  }
}
