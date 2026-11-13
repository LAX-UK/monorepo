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
  active: boolean | "unreadable";
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
      activity: vi
        .fn()
        .mockResolvedValue(
          options.active === "unreadable" ? "unreadable" : options.active ? "active" : "inactive",
        ),
      eventTypes: () => ["invoice.raised", "payment.captured", "payment.refunded"],
      project,
    },
    sender: { tick: vi.fn() },
    cursorStart: { startAtLatestEvent: vi.fn(), moveToLatestEvent: vi.fn() },
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

  it("with no product aimed at Books, queues nothing and moves its cursor past the events of now", async () => {
    const { ctx, accounting } = ctxWith({
      active: false,
      project: async () => ({ outcome: "skipped", reason: "books_not_selected" }),
    });
    (ctx.deliveryRepo?.claim as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([DELIVERY])
      .mockResolvedValue([]);
    await processAccountingProjector(ctx);
    expect(accounting.cursorStart.moveToLatestEvent).toHaveBeenCalledWith(ACCOUNTING_PROJECTOR);
    expect(accounting.cursorStart.startAtLatestEvent).not.toHaveBeenCalled();
    expect(ctx.domainEventReader.listLockedForProjector).not.toHaveBeenCalled();
    expect(ctx.deliveryRepo?.ensurePending).not.toHaveBeenCalled();
    // A delivery queued before Books was switched off is settled now, skipped, not kept for later.
    expect(ctx.deliveryRepo?.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "books_not_selected" }),
    );
  });

  it("with a switch it cannot read, moves nothing and runs nothing", async () => {
    const { ctx, accounting, project } = ctxWith({ active: "unreadable" });
    await processAccountingProjector(ctx);
    expect(accounting.cursorStart.moveToLatestEvent).not.toHaveBeenCalled();
    expect(accounting.cursorStart.startAtLatestEvent).not.toHaveBeenCalled();
    expect(ctx.domainEventReader.listLockedForProjector).not.toHaveBeenCalled();
    expect(ctx.deliveryRepo?.claim).not.toHaveBeenCalled();
    expect(project).not.toHaveBeenCalled();
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

/**
 * The event log, the projector's cursor and its delivery ledger held in memory, with the same
 * rules as the database: the cursor only moves forward, a delivery is queued once per event.
 */
function eventLogWorld() {
  const events: (typeof EVENT)[] = [];
  let cursor: number | null = null;
  const pending: { id: number; eventId: number }[] = [];
  const queued = new Set<number>();
  let active = false;
  const projected: number[] = [];
  const newest = () => Math.max(0, ...events.map((e) => e.id));
  const accounting = {
    projection: {
      activity: async () => (active ? "active" : "inactive"),
      eventTypes: () => ["invoice.raised"],
      project: async (event: typeof EVENT): Promise<ProjectionOutcome> => {
        if (!active) return { outcome: "skipped", reason: "books_not_selected" };
        projected.push(event.id);
        return { outcome: "projected", created: 2, replayed: 0, kept: 0 };
      },
    },
    sender: { tick: vi.fn() },
    cursorStart: {
      startAtLatestEvent: async () => {
        cursor ??= newest();
      },
      moveToLatestEvent: async () => {
        cursor = Math.max(cursor ?? 0, newest());
      },
    },
  } as unknown as AccountingRuntime;
  const ctx = {
    projectorStateRepo: {
      advanceCursorLiteralName: async (_name: string, id: number) => {
        cursor = Math.max(cursor ?? 0, id);
      },
    },
    domainEventReader: {
      listLockedForProjector: async () => events.filter((e) => e.id > (cursor ?? 0)),
      getById: async (id: number) => events.find((e) => e.id === id),
    },
    transactionRunner: { runInTransaction: async (fn: (tx: never) => unknown) => fn({} as never) },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    deliveryRepo: {
      ensurePending: async ({ eventId }: { eventId: number }) => {
        if (queued.has(eventId)) return;
        queued.add(eventId);
        pending.push({ id: eventId * 10, eventId });
      },
      claim: async () => {
        const next = pending.shift();
        return next ? [{ ...DELIVERY, id: next.id, eventId: next.eventId }] : [];
      },
      renewLease: vi.fn(),
      markSucceeded: vi.fn(),
      markSkipped: vi.fn(),
      scheduleRetry: vi.fn(),
      deadLetter: vi.fn(),
      oldestPendingAt: async () => null,
    },
    accounting,
  } as unknown as ProjectorRunContext;
  return {
    ctx,
    projected,
    emit: (id: number) => events.push({ ...EVENT, id }),
    setActive: (on: boolean) => {
      active = on;
    },
    tick: () => processAccountingProjector(ctx),
  };
}

describe("accounting projector, switched off and on again", () => {
  it("never projects the events of the time Books was off", async () => {
    const world = eventLogWorld();
    world.emit(1);
    world.setActive(true);
    await world.tick();
    world.emit(2);
    await world.tick();
    expect(world.projected).toEqual([2]);

    // Books is switched off (back to Xero): these events are Xero's.
    world.setActive(false);
    world.emit(3);
    await world.tick();
    world.emit(4);
    await world.tick();

    // Books is switched on again: only what happens from now on is projected.
    world.setActive(true);
    await world.tick();
    world.emit(5);
    await world.tick();
    expect(world.projected).toEqual([2, 5]);
  });

  it("does not project a gap that opened before the first tick that saw Books off", async () => {
    const world = eventLogWorld();
    world.setActive(true);
    await world.tick();
    world.setActive(false);
    // Events written between the switch flip and the next tick are still skipped.
    world.emit(1);
    world.emit(2);
    await world.tick();
    world.setActive(true);
    world.emit(3);
    await world.tick();
    expect(world.projected).toEqual([3]);
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
