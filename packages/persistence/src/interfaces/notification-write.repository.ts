import type { UserNotification } from "@auction/types";
import type { NotificationPayload } from "./notification-outbox.repository.js";

export type CreateNotificationRow = {
  userId: string;
  type: string;
  title: string;
  message: string;
  lotId?: string | undefined;
  submissionId?: string | undefined;
  saleId?: string | undefined;
  /**
   * The account the notification is about (a personal or organisation legal entity); `null`
   * means the person's own personal account. Required so every producer decides it.
   */
  legalEntityId: string | null;
  /**
   * Set when the same notice may be written twice (an event projector retrying): a second row with
   * the key is skipped. Include the person, since one event can notify several people.
   */
  dedupeKey?: string | undefined;
  /** Ephemeral fields for email/push channels (not stored on `notification` rows). */
  meta?: NotificationPayload["meta"];
};

export interface INotificationWriteRepository {
  createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]>;
}
