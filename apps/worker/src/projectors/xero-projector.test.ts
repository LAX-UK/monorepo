import { describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { processXeroProjector } from "./xero-projector.js";

const validPayoutPaidPayload = {
  legalEntityId: "44444444-4444-4444-8444-444444444444",
  status: "paid" as const,
  stripeTransferId: "tr_1",
  grossAmount: "1000.00",
  platformFee: "100.00",
  stripeFee: "10.00",
  netAmount: "890.00",
  currency: "GBP",
  processedAt: "2026-07-21T12:00:00.000Z",
  via: "mark_paid",
};

function baseCtx(overrides: Partial<ProjectorRunContext> = {}): ProjectorRunContext {
  return {
    projectorStateRepo: {
      ensureCursor: vi.fn(),
      getCursor: vi.fn().mockResolvedValue(0),
      advanceCursor: vi.fn(),
      advanceCursorLiteralName: vi.fn(),
      recordError: vi.fn(),
    },
    domainEventReader: {
      listAfterCursor: vi.fn().mockResolvedValue([]),
      getById: vi.fn(),
      listLockedForProjector: vi.fn().mockResolvedValue([
        {
          id: 10,
          eventType: "payout.paid",
          aggregateId: "po-1",
          payload: validPayoutPaidPayload,
        },
      ]),
    },
    projectorFailureRecorder: { record: vi.fn() },
    transactionRunner: {
      runInTransaction: vi.fn(async (fn) => fn({} as never)),
    },
    notificationWriteRepo: { createMany: vi.fn().mockResolvedValue([]) },
    adminReviewTaskProjectorRepo: {} as never,
    notificationFanoutReader: {} as never,
    adminImpersonationNotifyReader: {} as never,
    paymentRefundNotifyReader: {} as never,
    payoutTransferFailedNotifyReader: {} as never,
    clearArtistBlocksRepo: {} as never,
    ensurePersonalLegalEntity: {} as never,
    sourceOfFundsSettlementReader: {} as never,
    sourceOfFundsBuyerReader: {} as never,
    sourceOfFundsDocumentsTaskRepo: {} as never,
    sourceOfFundsDocumentReviewRepo: {} as never,
    sourceOfFundsReviewResolutionRepo: {} as never,
    lotNotifyReader: {} as never,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    staffOpsRecipientReader: {} as never,
    complianceRecipientReader: {} as never,
    env: { XERO_PROJECTOR_MODE: "shadow" } as never,
    deliveryRepo: {
      ensurePending: vi.fn(),
      claim: vi.fn().mockResolvedValue([
        {
          id: 1,
          consumer: "xero",
          eventId: 10,
          idempotencyKey: "xero:payout_bill:10",
          status: "processing",
          attempts: 1,
          nextRetryAt: null,
          lastError: null,
          providerReference: null,
          leaseExpiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      renewLease: vi.fn(),
      markSucceeded: vi.fn(),
      scheduleRetry: vi.fn(),
      deadLetter: vi.fn(),
      replay: vi.fn(),
      getById: vi.fn(),
      listDeadLettered: vi.fn(),
    },
    ...overrides,
  };
}

describe("processXeroProjector", () => {
  it("uses domain_event_delivery and compares legacy shadow commands", async () => {
    const ctx = baseCtx();
    ctx.domainEventReader.getById = vi.fn().mockResolvedValue({
      id: 10,
      eventType: "payout.paid",
      aggregateId: "po-1",
      payload: validPayoutPaidPayload,
    });

    await processXeroProjector(ctx);

    expect(ctx.deliveryRepo?.ensurePending).toHaveBeenCalledWith(
      expect.objectContaining({ consumer: "xero", eventId: 10 }),
    );
    expect(ctx.deliveryRepo?.markSucceeded).toHaveBeenCalled();
    expect(ctx.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ shadowDiff: expect.objectContaining({ equal: true }) }),
      "xero_projector_shadow_command",
    );
  });
});
