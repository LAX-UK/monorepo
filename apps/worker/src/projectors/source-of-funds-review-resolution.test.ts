import type pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { processSourceOfFundsReviewResolution } from "./source-of-funds-review-resolution.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as pino.Logger;

function makeCtx(
  eventRow: {
    id: number;
    eventType: string;
    aggregateId: string;
    actorUserId?: string | null;
    payload: unknown;
  },
  resolveImpl: ProjectorRunContext["sourceOfFundsReviewResolutionRepo"]["resolveIfTerminal"],
): ProjectorRunContext {
  return {
    projectorStateRepo: {
      ensureCursor: vi.fn(),
      getCursor: vi.fn().mockResolvedValue(0),
      advanceCursor: vi.fn(),
      advanceCursorLiteralName: vi.fn(),
      recordError: vi.fn(),
    },
    domainEventReader: {
      listAfterCursor: vi.fn().mockResolvedValue([eventRow]),
      getById: vi.fn(),
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
    sourceOfFundsDocumentReviewRepo: {} as never,
    sourceOfFundsReviewResolutionRepo: { resolveIfTerminal: resolveImpl },
    lotNotifyReader: {} as never,
    log,
    staffOpsRecipientReader: { listRecipients: vi.fn() },
    complianceRecipientReader: { listRecipients: vi.fn() },
  };
}

describe("processSourceOfFundsReviewResolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a pending review task when the case is terminal", async () => {
    const eventRow = {
      id: 12,
      eventType: "source_of_funds.reviewed",
      aggregateId: "sof_1",
      actorUserId: "mlro_1",
      payload: {
        sourceOfFundsId: "sof_1",
        userId: "u1",
        status: "approved",
      },
    };
    const resolveIfTerminal = vi.fn(async (sourceOfFundsId, _actorUserId, l) => {
      l.info({ sourceOfFundsId, taskId: "task_1" }, "source_of_funds_review_task_resolved");
    });
    const ctx = makeCtx(eventRow, resolveIfTerminal);

    await processSourceOfFundsReviewResolution({ ctx, log });

    expect(resolveIfTerminal).toHaveBeenCalledWith("sof_1", "mlro_1", log);
    expect(log.info).toHaveBeenCalledWith(
      { sourceOfFundsId: "sof_1", taskId: "task_1" },
      "source_of_funds_review_task_resolved",
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it("advances the cursor when the task is already resolved", async () => {
    const eventRow = {
      id: 13,
      eventType: "source_of_funds.reviewed",
      aggregateId: "sof_2",
      actorUserId: "mlro_1",
      payload: { sourceOfFundsId: "sof_2", status: "approved" },
    };
    const resolveIfTerminal = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx(eventRow, resolveIfTerminal);

    await processSourceOfFundsReviewResolution({ ctx, log });

    expect(resolveIfTerminal).toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("warns and advances when no matching task exists", async () => {
    const eventRow = {
      id: 14,
      eventType: "source_of_funds.reviewed",
      aggregateId: "sof_missing",
      actorUserId: "mlro_1",
      payload: { sourceOfFundsId: "sof_missing", status: "approved" },
    };
    const resolveIfTerminal = vi.fn(async (sourceOfFundsId, _actor, l) => {
      l.warn({ sourceOfFundsId }, "source_of_funds_review_task_not_found_for_resolution");
    });
    const ctx = makeCtx(eventRow, resolveIfTerminal);

    await processSourceOfFundsReviewResolution({ ctx, log });

    expect(log.warn).toHaveBeenCalledWith(
      { sourceOfFundsId: "sof_missing" },
      "source_of_funds_review_task_not_found_for_resolution",
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it("skips resolution (without resolving the task) when the case is no longer terminal", async () => {
    const eventRow = {
      id: 15,
      eventType: "source_of_funds.reviewed",
      aggregateId: "sof_reopened",
      actorUserId: "mlro_1",
      payload: { sourceOfFundsId: "sof_reopened", status: "rejected" },
    };
    const resolveIfTerminal = vi.fn(async (sourceOfFundsId, _actor, l) => {
      l.info(
        { sourceOfFundsId, caseStatus: "pending" },
        "source_of_funds_review_resolution_skipped_non_terminal",
      );
    });
    const ctx = makeCtx(eventRow, resolveIfTerminal);

    await processSourceOfFundsReviewResolution({ ctx, log });

    expect(log.info).toHaveBeenCalledWith(
      { sourceOfFundsId: "sof_reopened", caseStatus: "pending" },
      "source_of_funds_review_resolution_skipped_non_terminal",
    );
    expect(log.error).not.toHaveBeenCalled();
  });
});
