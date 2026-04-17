import type { UserNotification } from "@auction/types";

/** SRP: publish persisted inbox rows to the user's realtime channel. */
export interface IUserNotificationPublisher {
  publish(userId: string, notification: UserNotification): Promise<void>;
}
