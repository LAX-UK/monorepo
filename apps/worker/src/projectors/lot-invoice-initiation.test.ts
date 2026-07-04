import { describe, expect, it, vi } from "vitest";
import {
  LOT_INVOICE_INITIATION_PROJECTOR,
  processLotInvoiceInitiation,
} from "./lot-invoice-initiation.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

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

describe("processLotInvoiceInitiation", () => {
  it("calls ensureLotInvoice only for sold lots with a winner", async () => {
    const ensureLotInvoice = vi.fn().mockResolvedValue(undefined);
    const soldRow = {
      id: 10,
      eventType: "lot.ended",
      aggregateId: "lot-sold",
      payload: { outcome: "sold", winnerId: "buyer-1" },
    };
    const noSaleRow = {
      id: 11,
      eventType: "lot.ended",
      aggregateId: "lot-nosale",
      payload: { outcome: "no_sale", winnerId: null },
    };
    const ctx = makeCtx([soldRow, noSaleRow]);

    await processLotInvoiceInitiation({ ctx, log, ensureLotInvoice });

    expect(ensureLotInvoice).toHaveBeenCalledTimes(1);
    expect(ensureLotInvoice).toHaveBeenCalledWith("lot-sold");
  });

  it("does not advance past a failing event until retry succeeds", async () => {
    const ensureLotInvoice = vi.fn().mockRejectedValue(new Error("api_down"));
    const row = {
      id: 5,
      eventType: "lot.ended",
      aggregateId: "lot-1",
      payload: { outcome: "sold", winnerId: "buyer-1" },
    };
    const ctx = makeCtx([row]);

    await processLotInvoiceInitiation({ ctx, log, ensureLotInvoice });

    expect(ensureLotInvoice).toHaveBeenCalledWith("lot-1");
  });
});

describe("LOT_INVOICE_INITIATION_PROJECTOR", () => {
  it("has a stable projector name", () => {
    expect(LOT_INVOICE_INITIATION_PROJECTOR).toBe("lot_invoice_initiation");
  });
});
