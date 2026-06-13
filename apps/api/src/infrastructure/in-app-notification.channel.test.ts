import { describe, expect, it, vi } from "vitest";
import { InAppNotificationChannel } from "../infrastructure/in-app-notification.channel.js";
import type { NotificationPayload } from "../services/interfaces/notification-channel.js";
import type { INotificationWriteRepository } from "../services/interfaces/notification-write.js";
import type { IUserNotificationPublisher } from "../services/interfaces/user-notification-publisher.js";

describe("InAppNotificationChannel", () => {
  it("skips duplicate in-app rows when outbox idempotency key was already delivered", async () => {
    const createMany = vi.fn().mockResolvedValue([]);
    const write = { createMany } as unknown as INotificationWriteRepository;
    const publisher = { publish: vi.fn() } as unknown as IUserNotificationPublisher;
    const cache = {
      get: vi.fn().mockResolvedValue("1"),
      set: vi.fn(),
      del: vi.fn(),
    };

    const channel = new InAppNotificationChannel(write, publisher, cache);
    const payload: NotificationPayload = {
      type: "lot_won",
      title: "Congratulations — you won",
      message: "You won.",
      lotId: "lot-1",
      meta: { outboxIdempotencyKey: "lot_won:lot-1:user-win" },
    };

    await channel.send("user-win", payload);

    expect(createMany).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
