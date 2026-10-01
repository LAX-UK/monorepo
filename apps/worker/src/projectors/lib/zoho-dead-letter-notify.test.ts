import { describe, expect, it, vi } from "vitest";
import { notifyZohoCrmDeadLetter } from "./zoho-dead-letter-notify.js";

describe("notifyZohoCrmDeadLetter", () => {
  it("uses an hourly generic idempotency key for shop events", async () => {
    const enqueue = vi.fn(async () => ({ outboxId: "outbox-1" }));
    const hourBucket = new Date().toISOString().slice(0, 13);
    await notifyZohoCrmDeadLetter({
      emailService: { enqueue },
      adminEmail: "ops@example.com",
      delivery: {
        id: 99,
        eventId: 1,
        consumer: "zoho",
        status: "dead_lettered",
        attempts: 5,
        lastError: "boom",
        nextRetryAt: null,
        leaseExpiresAt: null,
        providerReference: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      lastError: "boom",
      eventType: "shop.artwork.created",
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `shop-zoho-dead-letter:zoho:${hourBucket}`,
        vars: expect.objectContaining({
          lastError: expect.stringContaining("One or more Shop Zoho CRM deliveries failed"),
        }),
      }),
    );
  });

  it("ignores non-shop event types", async () => {
    const enqueue = vi.fn();
    await notifyZohoCrmDeadLetter({
      emailService: { enqueue },
      adminEmail: "ops@example.com",
      delivery: {
        id: 1,
        eventId: 1,
        consumer: "zoho",
        status: "dead_lettered",
        attempts: 1,
        lastError: "x",
        nextRetryAt: null,
        leaseExpiresAt: null,
        providerReference: null,
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      lastError: "x",
      eventType: "payment.captured",
    });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
