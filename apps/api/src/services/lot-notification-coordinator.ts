import type { INotificationWriteRepository } from "@auction/persistence/interfaces";
import type { ILotNotificationCoordinator } from "./interfaces/lot-notifications.js";
import type { IUserNotificationPublisher } from "./interfaces/user-notification-publisher.js";

export class LotNotificationCoordinator implements ILotNotificationCoordinator {
  constructor(
    private readonly notificationWrite: INotificationWriteRepository | null,
    private readonly userNotificationPublisher: IUserNotificationPublisher | null,
  ) {}

  async notifyLotCancelled(args: {
    lotId: string;
    title: string;
    recipients: { userId: string; legalEntityId: string | null }[];
  }): Promise<void> {
    if (!this.notificationWrite || !this.userNotificationPublisher) return;
    const persisted = await this.notificationWrite.createMany(
      args.recipients.map(({ userId, legalEntityId }) => ({
        userId,
        legalEntityId,
        type: "lot_cancelled",
        title: "Lot cancelled",
        message: `The lot "${args.title}" has been cancelled.`,
        lotId: args.lotId,
      })),
    );
    for (const row of persisted) {
      await this.userNotificationPublisher.publish(row.userId, row);
    }
  }
}
