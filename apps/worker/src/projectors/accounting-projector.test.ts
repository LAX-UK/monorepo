import { describe, expect, it, vi } from "vitest";
import {
  AccountingProjectionRefusedError,
  type ProjectionOutcome,
} from "../finance/accounting/accounting-projection.service.js";
import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import { ACCOUNTING_PROJECTOR, processAccountingProjector } from "./accounting-projector.js";
import { processAccountingSender } from "./accounting-sender.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000001";
const EVENT = {
  id: 7,
  eventType: "invoice.raised",
  aggregateId: INVOICE_ID,
  payload: {
    invoiceId: INVOICE_ID,
    lotId: "0b6a7c1e-5555-4a5b-8c9d-000000000005",
    buyerLegalEntityId: "0b6a7c1e-2222-4a5b-8c9d-000000000002",
    totalPence: 154_320,
    raisedAt: "2031-03-01T10:00:00.000Z",
  },
  schemaVersion: 1,
};

const DELIVERY = {
  id: 70,
  consumer: ACCOUNTING_PROJECTOR,
  eventId: 7,
  status: "processing",
  attempts: 1,
  leaseExpiresAt: new Date(Date.now() + 60_000),
  nextRetryAt: null,
  idempotencyKey: `${ACCOUNTING_PROJECTOR}:7`,
  providerReference: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function ctxWith(options: {
  active: boolean;
  project?: () => Promise<ProjectionOutcome>;
}) {
  const project = vi.fn(
    options.project ??
      (async (): Promise<ProjectionOutcome> => ({
        outcome: "projected",
        created: 2,
        replayed: 0,
        kept: 0,
      })),
  );
  const accounting = {
    projection: {
      isActive: vi.fn().mockResolvedValue(options.active),
      eventTypes: () => ["invoice.raised", "payment.captured", "payment.refunded"],
      project,
    },
    sender: { tick: vi.fn() },
    cursorStart: { startAtLatestEvent: vi.fn() },
  } as unknown as AccountingRuntime;
  const ctx = {
    projectorStateRepo: { advanceCursorLiteralName: vi.fn() },
    domainEventReader: {
      listLockedForProjector: vi.fn().mockResolvedValue([EVENT]),
      getById: vi.fn().mockResolvedValue(EVENT),
    },
    transactionRunner: { runInTransaction: vi.fn(async (fn) => fn({} as never)) },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    deliveryRepo: {
      ensurePending: vi.fn(),
      claim: vi.fn().mockResolvedValue([DELIVERY]),
      renewLease: vi.fn(),
      markSucceeded: vi.fn(),
      markSkipped: vi.fn(),
      scheduleRetry: vi.fn(),
      deadLetter: vi.fn(),
      oldestPendingAt: vi.fn().mockResolvedValue(null),
    },
    accounting,
  } as unknown as ProjectorRunContext;
  return { ctx, accounting, project };
}

describe("accounting projector", () => {
  it("does nothing while Books is not configured", async () => {
    const { ctx } = ctxWith({ active: true });
    await processAccountingProjector({ ...ctx, accounting: undefined });
    expect(ctx.deliveryRepo?.claim).not.toHaveBeenCalled();
    expect(ctx.domainEventReader.listLockedForProjector).not.toHaveBeenCalled();
  });

  it("with no product aimed at Books, reads the switch and writes nothing", async () => {
    const { ctx, accounting } = ctxWith({ active: false });
    await processAccountingProjector(ctx);
    expect(accounting.cursorStart.startAtLatestEvent).not.toHaveBeenCalled();
    expect(ctx.domainEventReader.listLockedForProjector).not.toHaveBeenCalled();
    expect(ctx.deliveryRepo?.ensurePending).not.toHaveBeenCalled();
  });

  it("starts at the newest event, queues its own deliveries and projects each one", async () => {
    const { ctx, accounting, project } = ctxWith({ active: true });
    await processAccountingProjector(ctx);
    expect(accounting.cursorStart.startAtLatestEvent).toHaveBeenCalledWith(ACCOUNTING_PROJECTOR);
    expect(ctx.domainEventReader.listLockedForProjector).toHaveBeenCalledWith(
      ACCOUNTING_PROJECTOR,
      expect.any(Number),
      expect.anything(),
      { eventTypes: ["invoice.raised", "payment.captured", "payment.refunded"] },
    );
    expect(ctx.deliveryRepo?.ensurePending).toHaveBeenCalledWith({
      consumer: ACCOUNTING_PROJECTOR,
      eventId: 7,
      idempotencyKey: `${ACCOUNTING_PROJECTOR}:7`,
    });
    expect(project).toHaveBeenCalledWith(EVENT);
    expect(ctx.deliveryRepo?.markSucceeded).toHaveBeenCalled();
  });

  it("marks a skipped event skipped, with its reason", async () => {
    const { ctx } = ctxWith({
      active: true,
      project: async () => ({ outcome: "skipped", reason: "books_not_selected" }),
    });
    await processAccountingProjector(ctx);
    expect(ctx.deliveryRepo?.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "books_not_selected" }),
    );
  });

  it("sends a refused event to the failed deliveries at once, without retrying", async () => {
    const { ctx } = ctxWith({
      active: true,
      project: async () => {
        throw new AccountingProjectionRefusedError("unmapped_line", "x");
      },
    });
    await processAccountingProjector(ctx);
    expect(ctx.deliveryRepo?.deadLetter).toHaveBeenCalled();
    expect(ctx.deliveryRepo?.scheduleRetry).not.toHaveBeenCalled();
  });

  it("refuses an event that breaks its contract without projecting it", async () => {
    const { ctx, project } = ctxWith({ active: true });
    const broken = { ...EVENT, payload: { invoiceId: "not-a-uuid" } };
    (ctx.domainEventReader.getById as ReturnType<typeof vi.fn>).mockResolvedValue(broken);
    await processAccountingProjector(ctx);
    expect(project).not.toHaveBeenCalled();
    expect(ctx.deliveryRepo?.deadLetter).toHaveBeenCalled();
  });
});

describe("accounting sender step", () => {
  it("keeps a failing tick to itself, so the projectors after it still run", async () => {
    const { ctx, accounting } = ctxWith({ active: true });
    (accounting.sender.tick as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));
    await expect(processAccountingSender(ctx)).resolves.toBeUndefined();
    expect(ctx.log.error).toHaveBeenCalled();
  });
});
