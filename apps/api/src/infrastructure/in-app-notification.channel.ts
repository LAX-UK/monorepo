import type {
  INotificationChannel,
  NotificationPayload,
} from "../services/interfaces/notification-channel.js";
import type { INotificationWriteRepository } from "../services/interfaces/notification-write.js";
import type { IUserNotificationPublisher } from "../services/interfaces/user-notification-publisher.js";

export class InAppNotificationChannel implements INotificationChannel {
  readonly channelKind = "in_app" as const;

  constructor(
    private readonly write: INotificationWriteRepository,
    private readonly publisher: IUserNotificationPublisher,
  ) {}

  supports(_type: string): boolean {
    return true;
  }

  async send(userId: string, payload: NotificationPayload): Promise<void> {
    const rows = await this.write.createMany([
      {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        lotId: payload.lotId,
      },
    ]);
    for (const row of rows) {
      await this.publisher.publish(row.userId, row);
    }
  }
}
