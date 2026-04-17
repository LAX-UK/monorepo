import type { NotificationPayload } from "./interfaces/notification-channel.js";
import type { CreateNotificationRow } from "./interfaces/notification-write.js";

export function notificationRowToPayload(row: CreateNotificationRow): NotificationPayload {
  return {
    type: row.type,
    title: row.title,
    message: row.message,
    auctionId: row.auctionId,
  };
}
