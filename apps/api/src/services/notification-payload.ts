import { lotPath } from "@auction/types";
import type { NotificationPayload } from "./interfaces/notification-channel.js";
import type { CreateNotificationRow } from "./interfaces/notification-write.js";

export function notificationRowToPayload(row: CreateNotificationRow): NotificationPayload {
  return {
    type: row.type,
    title: row.title,
    message: row.message,
    lotId: row.lotId,
    ...(row.meta != null ? { meta: row.meta } : {}),
  };
}

/** Canonical marketing lot path when `meta.lotTitle` is present. */
export function notificationLotWebPath(payload: NotificationPayload): string | undefined {
  if (!payload.lotId || !payload.meta?.lotTitle) return undefined;
  return lotPath({ id: payload.lotId, title: payload.meta.lotTitle });
}

export function notificationLotTitle(payload: NotificationPayload): string {
  return payload.meta?.lotTitle ?? "Lot";
}
