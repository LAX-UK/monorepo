import type pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { processSourceOfFundsDocumentReview } from "./source-of-funds-document-review.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as pino.Logger;

describe("processSourceOfFundsDocumentReview", () => {
  it("returns without error when there are no new events", async () => {
    const ctx: ProjectorRunContext = {
      projectorStateRepo: {
        ensureCursor: vi.fn(),
        getCursor: vi.fn().mockResolvedValue(0),
        advanceCursor: vi.fn(),
        advanceCursorLiteralName: vi.fn(),
        recordError: vi.fn(),
      },
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue([]),
        listLockedForProjector: vi.fn(),
      },
      projectorFailureRecorder: { record: vi.fn() },
      transactionRunner: { runInTransaction: vi.fn() },
      notificationWriteRepo: { createMany: vi.fn() },
      adminReviewTaskProjectorRepo: {} as never,
      notificationFanoutReader: {} as never,
      adminImpersonationNotifyReader: {} as never,
      paymentRefundNotifyReader: {} as never,
      payoutTransferFailedNotifyReader: {} as never,
      clearArtistBlocksRepo: {} as never,
      ensurePersonalLegalEntity: { ensure: vi.fn() },
      sourceOfFundsSettlementReader: {} as never,
      sourceOfFundsBuyerReader: {} as never,
      sourceOfFundsDocumentsTaskRepo: {} as never,
      sourceOfFundsDocumentReviewRepo: { upsertReview: vi.fn() },
      sourceOfFundsReviewResolutionRepo: {} as never,
      lotNotifyReader: {} as never,
      log,
      staffOpsRecipientReader: { listRecipients: vi.fn() },
      complianceRecipientReader: { listRecipients: vi.fn() },
    };
    await processSourceOfFundsDocumentReview({ ctx, log });
    expect(log.error).not.toHaveBeenCalled();
  });
});
