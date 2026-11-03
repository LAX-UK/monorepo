import { describe, expect, it, vi } from "vitest";
import type { CrmSyncResult } from "../integrations/crm/crm-sync-result.js";
import type { ZohoArtworkWritebackService } from "../integrations/zoho/artwork/zoho-artwork-writeback-service.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import {
  ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
  processZohoArtworkWriteback,
} from "./zoho-artwork-writeback-projector.js";

const EVENT = {
  id: 7,
  eventType: "artwork_register.offer_changed",
  aggregateId: "6f1c1d0e-0000-4000-8000-000000000001",
  payload: {
    schemaVersion: 1,
    registerId: "6f1c1d0e-0000-4000-8000-000000000001",
    zohoProductId: "5000000000001000001",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    fromState: "held",
    toState: "bid_sale",
  },
  schemaVersion: 1,
};

const DELIVERY = {
  id: 70,
  consumer: ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
  eventId: 7,
  status: "processing",
  attempts: 1,
  leaseExpiresAt: new Date(Date.now() + 60_000),
  nextRetryAt: null,
  idempotencyKey: `${ZOHO_ARTWORK_WRITEBACK_PROJECTOR}:7`,
  providerReference: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function ctxWith(result: CrmSyncResult | null): {
  ctx: ProjectorRunContext;
  deliver: ReturnType<typeof vi.fn>;
} {
  const deliver = vi.fn().mockResolvedValue(result);
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
    zohoArtworkWriteback: { deliver } as unknown as ZohoArtworkWritebackService,
  } as unknown as ProjectorRunContext;
  return { ctx, deliver };
}

describe("processZohoArtworkWriteback", () => {
  it("does nothing while the writeback is not built (mode off)", async () => {
    const { ctx } = ctxWith(null);
    const off = { ...ctx, zohoArtworkWriteback: undefined } as ProjectorRunContext;
    await processZohoArtworkWriteback(off);
    expect(ctx.deliveryRepo?.claim).not.toHaveBeenCalled();
  });

  it("queues each event under its own consumer and cursor, then delivers it", async () => {
    const { ctx, deliver } = ctxWith({ outcome: "success", providerReference: "Products:1" });
    await processZohoArtworkWriteback(ctx);

    expect(ctx.domainEventReader.listLockedForProjector).toHaveBeenCalledWith(
      ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
      expect.any(Number),
      expect.anything(),
      {
        eventTypes: ["artwork_register.offer_changed", "artwork_register.stock_code_assigned"],
      },
    );
    expect(ctx.deliveryRepo?.ensurePending).toHaveBeenCalledWith({
      consumer: ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
      eventId: 7,
      idempotencyKey: `${ZOHO_ARTWORK_WRITEBACK_PROJECTOR}:7`,
    });
    expect(ctx.projectorStateRepo.advanceCursorLiteralName).toHaveBeenCalledWith(
      ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
      7,
      expect.anything(),
    );
    expect(deliver).toHaveBeenCalledWith(EVENT);
    expect(ctx.deliveryRepo?.markSucceeded).toHaveBeenCalled();
  });

  it("marks a skipped delivery skipped with its reason", async () => {
    const { ctx } = ctxWith({ outcome: "skipped", reason: "dry_run" });
    await processZohoArtworkWriteback(ctx);
    expect(ctx.deliveryRepo?.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "dry_run" }),
    );
  });

  it("dead-letters a fatal result so it shows with the other failed Zoho deliveries", async () => {
    const { ctx } = ctxWith({ outcome: "fatal", error: new Error("INVALID_DATA") });
    await processZohoArtworkWriteback(ctx);
    expect(ctx.deliveryRepo?.deadLetter).toHaveBeenCalled();
    expect(ctx.deliveryRepo?.markSucceeded).not.toHaveBeenCalled();
  });

  it("schedules a retry for a retryable result", async () => {
    const { ctx } = ctxWith({ outcome: "retry", error: new Error("503") });
    await processZohoArtworkWriteback(ctx);
    expect(ctx.deliveryRepo?.scheduleRetry).toHaveBeenCalled();
    expect(ctx.deliveryRepo?.deadLetter).not.toHaveBeenCalled();
  });
});
