import { describe, expect, it, vi } from "vitest";
import type { NotificationPayload } from "./interfaces/notification-channel.js";
import type { INotificationOutboxRepository } from "./interfaces/notification-outbox.js";
import { NotificationOutboxProcessor } from "./notification-outbox.processor.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";

describe("NotificationOutboxProcessor", () => {
  it("dispatches claimed rows and acks on success", async () => {
    const payload: NotificationPayload = {
      type: "outbid",
      title: "You have been outbid",
      message: "Another bidder placed a higher bid.",
      lotId: "lot-1",
    };
    const outbox: INotificationOutboxRepository = {
      claim: vi.fn().mockResolvedValue([
        {
          id: "row-1",
          idempotencyKey: "outbid:lot-1:bid-1:user-prev",
          userId: "user-prev",
          payload,
          state: "claimed",
          attempts: 0,
          lastError: null,
          createdAt: new Date(),
          processedAt: null,
          claimedAt: new Date(),
        },
      ]),
      ack: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn(),
      countPending: vi.fn().mockResolvedValue(0),
      stage: vi.fn(),
    };
    const dispatchStrict = vi.fn().mockResolvedValue(undefined);
    const dispatcher = { dispatchStrict } as unknown as NotificationDispatcher;

    const processor = new NotificationOutboxProcessor(outbox, dispatcher);
    const result = await processor.processBatch(10);

    expect(dispatchStrict).toHaveBeenCalledWith("user-prev", {
      ...payload,
      meta: { outboxIdempotencyKey: "outbid:lot-1:bid-1:user-prev" },
    });
    expect(outbox.ack).toHaveBeenCalledWith(["row-1"]);
    expect(outbox.fail).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 1, failed: 0, pendingDepth: 0 });
  });

  it("marks row failed when dispatch throws", async () => {
    const outbox: INotificationOutboxRepository = {
      claim: vi.fn().mockResolvedValue([
        {
          id: "row-2",
          idempotencyKey: "lot_won:lot-1:user-win",
          userId: "user-win",
          payload: {
            type: "lot_won",
            title: "Congratulations — you won",
            message: "You won.",
          },
          state: "claimed",
          attempts: 0,
          lastError: null,
          createdAt: new Date(),
          processedAt: null,
          claimedAt: new Date(),
        },
      ]),
      ack: vi.fn(),
      fail: vi.fn().mockResolvedValue(undefined),
      countPending: vi.fn().mockResolvedValue(1),
      stage: vi.fn(),
    };
    const dispatcher = {
      dispatchStrict: vi.fn().mockRejectedValue(new Error("smtp down")),
    } as unknown as NotificationDispatcher;

    const processor = new NotificationOutboxProcessor(outbox, dispatcher);
    const result = await processor.processBatch(10);

    expect(outbox.fail).toHaveBeenCalledWith("row-2", "smtp down");
    expect(outbox.ack).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, failed: 1, pendingDepth: 1 });
  });
});
