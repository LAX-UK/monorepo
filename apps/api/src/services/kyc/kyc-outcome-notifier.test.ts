import { KYC_DECLINED_COPY } from "@auction/branding";
import { describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification.factory.js";
import { KycOutcomeNotifier } from "./kyc-outcome-notifier.js";

function build(user: { email: string | null } = { email: "a@b.com" }) {
  const users = { findById: vi.fn().mockResolvedValue({ id: "u1", name: "Alex", ...user }) };
  const email = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const notifications = { createMany: vi.fn().mockResolvedValue([]) };
  const notifier = new KycOutcomeNotifier(
    users as never,
    email as never,
    notifications as never,
    new NotificationFactory(),
    "https://test.lax.bid/",
  );
  return { email, notifications, notifier };
}

describe("KycOutcomeNotifier", () => {
  it("tells an approved person and links to registering for a sale", async () => {
    const { email, notifications, notifier } = build();
    await notifier.notify("u1", "approved", "sess-1:att-1");
    expect(email.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "kyc-approved",
        to: "a@b.com",
        userId: "u1",
        vars: { userName: "Alex", registerUrl: "https://test.lax.bid/sales" },
        idempotencyKey: "kyc-approved:u1:sess-1:att-1",
      }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "u1",
        type: "kyc_approved",
        legalEntityId: null,
        title: "Your identity is verified",
      }),
    ]);
  });

  it("tells a declined person with Try again and Contact us links, and no reason", async () => {
    const { email, notifications, notifier } = build();
    await notifier.notify("u1", "declined", "sess-1:none");
    expect(email.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "kyc-declined",
        vars: {
          userName: "Alex",
          retryUrl: "https://test.lax.bid/verify-identity",
          contactUrl: "https://test.lax.bid/contact",
        },
      }),
    );
    const [[rows]] = notifications.createMany.mock.calls as [[Array<Record<string, unknown>>]];
    expect(rows[0]).toMatchObject({
      type: "kyc_declined",
      title: KYC_DECLINED_COPY.headline,
      message: KYC_DECLINED_COPY.detail,
    });
    expect(JSON.stringify([email.enqueue.mock.calls, rows])).not.toMatch(/reason|code|veriff/i);
  });

  it("says nothing when the person has no email on file", async () => {
    const { email, notifications, notifier } = build({ email: null });
    await notifier.notify("u1", "approved", "k");
    expect(email.enqueue).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
