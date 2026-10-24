import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import type { IUserRepository } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import type { NotificationPayload } from "../services/interfaces/notification-channel.js";
import { EmailNotificationChannel } from "./email-notification.channel.js";

const USER_ID = "2f1c1a1e-7a0e-4c53-9d0b-6f1a2b3c4d5e";
const LOT_ID = "9b7d0a52-1f43-4b7a-8a55-0c2f6e1d3a90";
const BASE_URL = "https://test.lax.bid/";

function setup() {
  const enqueued: EmailEnqueueInput<TemplateName>[] = [];
  const email: IEmailService = {
    async enqueue(input) {
      enqueued.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "3c2b1a09-8d7e-4f6a-9b5c-4d3e2f1a0b9c" };
    },
  };
  const users = {
    async findById() {
      return { id: USER_ID, email: "ada@example.com", name: "Ada" };
    },
  } as unknown as IUserRepository;
  const channel = new EmailNotificationChannel(
    email,
    users,
    BASE_URL,
    "7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921",
  );
  return { channel, enqueued };
}

function payload(overrides: Partial<NotificationPayload>): NotificationPayload {
  return {
    type: "payment_received",
    title: "Payment received",
    message: 'Your payment for "Blue Vase" was recorded.',
    lotId: LOT_ID,
    meta: { lotTitle: "Blue Vase" },
    ...overrides,
  };
}

describe("EmailNotificationChannel payment receipt", () => {
  it("formats the amount from structured metadata and links to the buyer's purchases", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({ meta: { lotTitle: "Blue Vase", audience: "buyer", amount: "1250.00" } }),
    );
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.template).toBe("payment-receipt");
    expect(enqueued[0]?.vars).toMatchObject({
      lotTitle: "Blue Vase",
      amount: "£1,250.00",
      receiptUrl: "https://test.lax.bid/dashboard/purchases",
    });
  });

  it("never prints the notification sentence as the amount", async () => {
    const { channel, enqueued } = setup();
    await channel.send(USER_ID, payload({ meta: { lotTitle: "Blue Vase", audience: "buyer" } }));
    expect(enqueued[0]?.vars).toMatchObject({ amount: null });
    expect(JSON.stringify(enqueued[0]?.vars)).not.toContain("was recorded");
  });

  it("does not send the buyer's receipt to the seller's recipients", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({
        message: 'Payment of 1250.00 was recorded for "Blue Vase".',
        meta: { lotTitle: "Blue Vase", audience: "seller", amount: "1250.00" },
      }),
    );
    expect(enqueued).toHaveLength(0);
  });
});
