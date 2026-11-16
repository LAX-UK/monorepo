import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { KycNoticeQueue } from "./kyc-notice-queue.js";

const tx = { name: "decision-transaction" } as unknown as Database;
const ADDRESS = "ada@example.com";

function setup(
  user: { email: string; name: string } | null = { email: ADDRESS, name: "Ada" },
  off: { email?: boolean; app?: boolean } = {},
) {
  const isChannelEnabled = vi.fn(async (_userId: string, _type: string, channel: string) =>
    channel === "email" ? !off.email : !off.app,
  );
  const findById = vi.fn(async () => user);
  const createMany = vi.fn(async () => []);
  const enqueueInTransaction = vi.fn(async () => ({ outboxId: "outbox-tx" }));
  const usersFor = vi.fn(() => ({ findById }) as never);
  const notificationsFor = vi.fn(() => ({ createMany }));
  const queue = new KycNoticeQueue({
    usersFor,
    notificationsFor,
    email: { enqueueInTransaction },
    factory: {
      createKycApproved: (userId) => ({ userId, type: "kyc_approved" }) as never,
      createKycDeclined: (userId) => ({ userId, type: "kyc_declined" }) as never,
    },
    preferences: { isChannelEnabled: isChannelEnabled as never },
    webOrigin: "https://lax.bid/",
  });
  return { isChannelEnabled, queue, usersFor, notificationsFor, createMany, enqueueInTransaction };
}

const approved = {
  userId: "u1",
  outcome: "approved" as const,
  providerSessionId: "session-1",
  providerAttemptId: "attempt-1",
};

describe("KycNoticeQueue preferences", () => {
  it("asks only for the app switch, by the notice's type", async () => {
    const { queue, isChannelEnabled } = setup();
    await queue.queueOutcome(tx, { ...approved, outcome: "declined" });
    expect(isChannelEnabled).toHaveBeenCalledWith("u1", "kyc_declined", "in_app");
    expect(isChannelEnabled).not.toHaveBeenCalledWith("u1", "kyc_declined", "email");
  });

  it.each(["approved", "declined"] as const)(
    "always emails the %s result: it is transactional, whatever the switches say",
    async (outcome) => {
      const { queue, createMany, enqueueInTransaction } = setup(undefined, {
        email: true,
        app: true,
      });
      await queue.queueOutcome(tx, { ...approved, outcome });
      expect(enqueueInTransaction).toHaveBeenCalledTimes(1);
      expect(enqueueInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ template: `kyc-${outcome}`, category: "transactional" }),
      );
      expect(createMany).not.toHaveBeenCalled();
    },
  );

  it.each(["approved", "declined"] as const)(
    "sends the email and the app notice for %s with the app switch on",
    async (outcome) => {
      const { queue, createMany, enqueueInTransaction } = setup();
      await queue.queueOutcome(tx, { ...approved, outcome });
      expect(enqueueInTransaction).toHaveBeenCalledTimes(1);
      expect(createMany).toHaveBeenCalledTimes(1);
    },
  );

  it("never gates the request to send documents again: it waits for the person to act", async () => {
    const { queue, createMany, enqueueInTransaction, isChannelEnabled } = setup(undefined, {
      email: true,
      app: true,
    });
    await queue.queueResubmission(tx, {
      userId: "u1",
      providerSessionId: "session-1",
      providerAttemptId: null,
      feedback: { headline: "We need a clearer photo", reasonCode: "document_unreadable" },
    } as never);
    expect(isChannelEnabled).not.toHaveBeenCalled();
    expect(enqueueInTransaction).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledTimes(1);
  });
});

describe("KycNoticeQueue", () => {
  it("queues the approval email and the in-app notice in the decision's transaction", async () => {
    const { queue, usersFor, notificationsFor, createMany, enqueueInTransaction } = setup();

    await queue.queueOutcome(tx, approved);

    expect(usersFor).toHaveBeenCalledWith(tx);
    expect(notificationsFor).toHaveBeenCalledWith(tx);
    expect(enqueueInTransaction).toHaveBeenCalledWith(tx, {
      template: "kyc-approved",
      to: ADDRESS,
      userId: "u1",
      category: "transactional",
      vars: { userName: "Ada", registerUrl: "https://lax.bid/sales" },
      idempotencyKey: "kyc-approved:u1:session-1:attempt-1",
    });
    expect(createMany).toHaveBeenCalledWith([{ userId: "u1", type: "kyc_approved" }]);
  });

  it("keys a decision by the account and the decision, never by the address", async () => {
    const { queue, enqueueInTransaction } = setup();

    await queue.queueOutcome(tx, { ...approved, outcome: "declined", providerAttemptId: null });

    const call = enqueueInTransaction.mock.calls[0] as unknown as [
      unknown,
      { idempotencyKey: string; template: string },
    ];
    expect(call[1].template).toBe("kyc-declined");
    expect(call[1].idempotencyKey).toBe("kyc-declined:u1:session-1:none");
    expect(call[1].idempotencyKey).not.toContain("@");
  });

  it("gives the resubmission email a key for the decision, so a repeat makes no second email", async () => {
    const { queue, enqueueInTransaction, createMany } = setup();

    await queue.queueResubmission(tx, {
      userId: "u1",
      providerSessionId: "session-1",
      providerAttemptId: "attempt-1",
      feedback: {
        headline: "More information needed",
        detail: "Provider reason quoting Ada Lovelace, passport 123",
        action: "continue",
        reasonCode: 202,
        decisionStatus: "resubmission_requested",
        needsResubmit: true,
      },
    });

    expect(enqueueInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        template: "kyc-resubmission-required",
        idempotencyKey: "kyc-resubmission-required:u1:session-1:attempt-1",
        vars: {
          userName: "Ada",
          issueDetail: "Make sure your face is fully visible and well lit in the selfie.",
          verifyUrl: "https://lax.bid/verify-identity",
        },
      }),
    );
    expect(createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "kyc_resubmission_required",
        title: "More information needed",
        message: "Make sure your face is fully visible and well lit in the selfie.",
      }),
    ]);
  });

  it("never stores the provider's decline reason in the email or the notice", async () => {
    const { queue, enqueueInTransaction, createMany } = setup();

    await queue.queueResubmission(tx, {
      userId: "u1",
      providerSessionId: "session-1",
      providerAttemptId: null,
      feedback: {
        headline: "More information needed",
        detail: "Name on document does not match Ada Lovelace",
        action: "continue",
        reasonCode: null,
        decisionStatus: "resubmission_requested",
        needsResubmit: true,
      },
    });

    const stored = JSON.stringify([enqueueInTransaction.mock.calls, createMany.mock.calls]);
    expect(stored).not.toContain("Lovelace");
    expect(stored).toContain("Use good lighting, keep the document flat");
  });

  it("queues nothing for a person with no address", async () => {
    const { queue, enqueueInTransaction, createMany } = setup(null);

    await queue.queueOutcome(tx, approved);

    expect(enqueueInTransaction).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("lets a failure to queue reach the decision's transaction, so nothing is half stored", async () => {
    const { queue, enqueueInTransaction } = setup();
    enqueueInTransaction.mockRejectedValueOnce(new Error("outbox unavailable"));

    await expect(queue.queueOutcome(tx, approved)).rejects.toThrow("outbox unavailable");
  });
});
