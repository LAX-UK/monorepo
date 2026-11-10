import { describe, expect, it, vi } from "vitest";

const claim = vi.hoisted(() => ({ tryClaimProcessedWebhookEvent: vi.fn() }));
vi.mock("../../lib/processed-webhook-event.js", () => claim);

import type { Database } from "@auction/db";
import type { KycServiceDeps } from "./kyc-context.js";
import type { IKycNoticeQueue } from "./kyc-notice-queue.js";
import { KycWebhookIngestService } from "./kyc-webhook-ingest.service.js";

const tx = { name: "decision-transaction" } as unknown as Database;
const body = JSON.stringify({
  status: "success",
  verification: { id: "session-1", attemptId: "attempt-1", status: "approved" },
});
const notice = {
  userId: "u1",
  outcome: "approved" as const,
  providerSessionId: "session-1",
  providerAttemptId: "attempt-1",
};

function setup(options: { transactional?: boolean; applied?: object } = {}) {
  const { transactional = true } = options;
  const order: string[] = [];
  const notices: IKycNoticeQueue = {
    queueOutcome: vi.fn(async () => {
      order.push("queued");
    }),
    queueResubmission: vi.fn(async () => {
      order.push("queued");
    }),
  };
  const apply = vi.fn(async () => ({
    verification: null,
    appliedUserKycUpdate: true,
    shouldProgressIndividuals: false,
    outcomeNotify: notice,
    ...options.applied,
  }));
  const deps = {
    veriffClient: { isConfigured: () => true },
    sharedSecret: "secret",
    transactionRunner: transactional
      ? {
          runInTransaction: async (fn: (t: Database) => Promise<unknown>) => {
            const result = await fn(tx);
            order.push("committed");
            return result;
          },
        }
      : null,
    sessionRepo: {
      findByProviderSessionId: async () => ({ id: "kyc-1", userId: "u1" }),
      getUserKycState: async () => ({ kycStatus: "pending" }),
    },
    notices,
  } as unknown as KycServiceDeps;
  const service = new KycWebhookIngestService(
    deps,
    { verify: () => undefined } as never,
    {
      apply,
    } as never,
  );
  return { service, notices, order, apply };
}

describe("applying an identity decision", () => {
  it("queues what the person is told in the decision's own transaction, before it commits", async () => {
    claim.tryClaimProcessedWebhookEvent.mockResolvedValue({ claimed: true });
    const { service, notices, order } = setup();

    await service.handleDecisionWebhook(body, "sig", "client");

    expect(notices.queueOutcome).toHaveBeenCalledWith(tx, notice);
    expect(order).toEqual(["queued", "committed"]);
  });

  it("does not hand the notices back to the caller", async () => {
    claim.tryClaimProcessedWebhookEvent.mockResolvedValue({ claimed: true });
    const { service } = setup();

    const result = await service.handleDecisionWebhook(body, "sig", "client");

    expect(result).toEqual({
      verification: null,
      appliedUserKycUpdate: true,
      shouldProgressIndividuals: false,
    });
  });

  it("tells nobody again when the same decision is delivered again", async () => {
    claim.tryClaimProcessedWebhookEvent.mockResolvedValue({ claimed: false });
    const { service, notices, apply } = setup();

    await service.handleDecisionWebhook(body, "sig", "client");

    expect(apply).not.toHaveBeenCalled();
    expect(notices.queueOutcome).not.toHaveBeenCalled();
    expect(notices.queueResubmission).not.toHaveBeenCalled();
  });

  it("fails the delivery when the notices cannot be queued, so the decision is applied again on retry", async () => {
    claim.tryClaimProcessedWebhookEvent.mockResolvedValue({ claimed: true });
    const { service, notices, order } = setup();
    vi.mocked(notices.queueOutcome).mockRejectedValueOnce(new Error("outbox unavailable"));

    await expect(service.handleDecisionWebhook(body, "sig", "client")).rejects.toThrow(
      "outbox unavailable",
    );
    expect(order).not.toContain("committed");
  });

  it("queues a resubmission request in the same transaction", async () => {
    claim.tryClaimProcessedWebhookEvent.mockResolvedValue({ claimed: true });
    const resubmission = {
      userId: "u1",
      providerSessionId: "session-1",
      providerAttemptId: "attempt-1",
      feedback: { headline: "More information needed" },
    };
    const { service, notices } = setup({
      applied: { outcomeNotify: undefined, resubmissionNotify: resubmission },
    });

    await service.handleDecisionWebhook(body, "sig", "client");

    expect(notices.queueResubmission).toHaveBeenCalledWith(tx, resubmission);
    expect(notices.queueOutcome).not.toHaveBeenCalled();
  });

  it("queues without a transaction only where there is no transaction runner", async () => {
    const { service, notices } = setup({ transactional: false });

    await service.handleDecisionWebhook(body, "sig", "client");

    expect(notices.queueOutcome).toHaveBeenCalledWith(null, notice);
  });
});
