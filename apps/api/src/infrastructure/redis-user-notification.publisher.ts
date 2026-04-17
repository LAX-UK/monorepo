import type { UserNotification } from "@auction/types";
import type { Redis } from "ioredis";
import type { IUserNotificationPublisher } from "../services/interfaces/user-notification-publisher.js";

export class RedisUserNotificationPublisher implements IUserNotificationPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(userId: string, notification: UserNotification): Promise<void> {
    const channel = `user:${userId}:notifications`;
    const body = JSON.stringify({
      type: "notification_created",
      notification: {
        ...notification,
        createdAt:
          notification.createdAt instanceof Date
            ? notification.createdAt.toISOString()
            : notification.createdAt,
      },
    });
    await this.redis.publish(channel, body);
  }
}
