import { describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import {
  UNSOLD_CHOICE_DEADLINE_PROJECTOR,
  UnsoldChoiceDeadlineRecorder,
  processUnsoldChoiceDeadline,
} from "./unsold-choice-deadline.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

function makeCtx(
  rows: Array<{ id: number; eventType: string; aggregateId: string; payload: unknown }>,
  overrides: Partial<ProjectorRunContext> = {},
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
      listAfterCursor: vi.fn().mockResolvedValue(rows),
      getById: vi.fn(),
      listLockedForProjector: vi.fn(),
    },
    projectorFailureRecorder: {
      record: vi.fn().mockResolvedValue({ action: "retry", failures: 1 }),
    },
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
    sourceOfFundsReviewResolutionRepo: {} as never,
    lotNotifyReader: {} as never,
    log,
    staffOpsRecipientReader: { listRecipients: vi.fn() },
    complianceRecipientReader: { listRecipients: vi.fn() },
    ...overrides,
  };
}

describe("processUnsoldChoiceDeadline", () => {
  it("records a date for lots that ended without selling, and moves the cursor", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx([
      {
        id: 10,
        eventType: "lot.ended",
        aggregateId: "lot-unsold",
        payload: { outcome: "no_sale" },
      },
      { id: 11, eventType: "lot.ended", aggregateId: "lot-sold", payload: { outcome: "sold" } },
    ]);
    await processUnsoldChoiceDeadline({ ctx, log, recorder: { record } });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith("lot-unsold");
    expect(ctx.projectorStateRepo.advanceCursor).toHaveBeenCalledWith(
      UNSOLD_CHOICE_DEADLINE_PROJECTOR,
      11,
    );
  });

  it("stops at a failure so the event is retried", async () => {
    const record = vi.fn().mockRejectedValue(new Error("db down"));
    const ctx = makeCtx([
      {
        id: 10,
        eventType: "lot.ended",
        aggregateId: "lot-unsold",
        payload: { outcome: "no_sale" },
      },
    ]);
    await processUnsoldChoiceDeadline({ ctx, log, recorder: { record } });
    expect(ctx.projectorStateRepo.advanceCursor).not.toHaveBeenCalled();
  });
});

describe("UnsoldChoiceDeadlineRecorder", () => {
  it("stores the window's date for a consigned lot that ended unsold", async () => {
    const lotEndTime = new Date("2026-11-01T18:00:00Z");
    const keep = vi.fn(async (p: unknown[]) => p);
    const recorder = new UnsoldChoiceDeadlineRecorder({
      unsoldOutcomeOf: async () => ({ lotId: "l1", lotEndTime }),
      keep,
      kept: async () => [],
    } as never);
    await recorder.record("l1");
    expect(keep).toHaveBeenCalledWith([
      { lotId: "l1", lotEndTime, chooseBy: new Date("2026-11-15T18:00:00Z") },
    ]);
  });

  it("stores nothing for a lot that is not an unsold consignment", async () => {
    const keep = vi.fn();
    const recorder = new UnsoldChoiceDeadlineRecorder({
      unsoldOutcomeOf: async () => null,
      keep,
      kept: async () => [],
    } as never);
    await recorder.record("l1");
    expect(keep).not.toHaveBeenCalled();
  });
});
