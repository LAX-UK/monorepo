import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { KycNoticeQueue } from "./kyc-notice-queue.js";

const tx = { name: "decision-transaction" } as unknown as Database;
const ADDRESS = "ada@example.com";

function setup(user: { email: string; name: string } | null = { email: ADDRESS, name: "Ada" }) {
  const findById = vi.fn(async () => user);
  const createMany = vi.fn(async () => []);
  const enqueue = vi.fn(async () => ({ outboxId: "outbox-plain" }));
  const enqueueInTransaction = vi.fn(async () => ({ outboxId: "outbox-tx" }));
  const usersFor = vi.fn(() => ({ findById }) as never);
  const notificationsFor = vi.fn(() => ({ createMany }));
  const queue = new KycNoticeQueue({
    usersFor,
    notificationsFor,
    email: { enqueue, enqueueInTransaction },
    factory: {
      createKycApproved: (userId) => ({ userId, type: "kyc_approved" }) as never,
      createKycDeclined: (userId) => ({ userId, type: "kyc_declined" }) as never,
    },
    webOrigin: "https://lax.bid/",
  });
  return { queue, usersFor, notificationsFor, createMany, enqueue, enqueueInTransaction };
}

const approved = {
  userId: "u1",
  outcome: "approved" as const,
  providerSessionId: "session-1",
  providerAttemptId: "attempt-1",
};

describe("KycNoticeQueue", () => {
  it("queues the approval email and the in-app notice in the decision's transaction", async () => {
    const { queue, usersFor, notificationsFor, createMany, enqueueInTransaction, enqueue } =
      setup();

    await queue.queueOutcome(tx, approved);

    expect(usersFor).toHaveBeenCalledWith(tx);
    expect(notificationsFor).toHaveBeenCalledWith(tx);
    expect(enqueue).not.toHaveBeenCalled();
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
        detail: "Retake selfie",
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
          issueDetail: "Retake selfie",
          verifyUrl: "https://lax.bid/verify-identity",
        },
      }),
    );
    expect(createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "kyc_resubmission_required",
        title: "More information needed",
      }),
    ]);
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

  it("falls back to the plain queue only when there is no transaction", async () => {
    const { queue, enqueue, enqueueInTransaction } = setup();

    await queue.queueOutcome(null, approved);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueueInTransaction).not.toHaveBeenCalled();
  });
});
