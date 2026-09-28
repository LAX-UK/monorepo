import { describe, expect, it, vi } from "vitest";
import type { CrmSyncResult } from "../integrations/crm/crm-sync-result.js";
import type { CrmSyncService } from "../integrations/crm/crm-sync-service.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { processZohoProjector } from "./zoho-projector.js";

function baseCtx(overrides: Partial<ProjectorRunContext> = {}): ProjectorRunContext {
  return {
    projectorStateRepo: {
      ensureCursor: vi.fn(),
      getCursor: vi.fn(),
      advanceCursor: vi.fn(),
      advanceCursorLiteralName: vi.fn(),
      recordError: vi.fn(),
    },
    domainEventReader: {
      listAfterCursor: vi.fn(),
      getById: vi.fn(),
      listLockedForProjector: vi.fn().mockResolvedValue([]),
    },
    projectorFailureRecorder: { record: vi.fn() },
    transactionRunner: {
      runInTransaction: vi.fn(async (fn) => fn({} as never)),
    },
    notificationWriteRepo: { createMany: vi.fn() },
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
    env: {
      ZOHO_CRM_SYNC_MODE: "dry_run",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered",
      ZOHO_CRM_CURSOR_BATCH_SIZE: 100,
      ZOHO_CRM_TICK_TIME_BUDGET_MS: 2_000,
    } as never,
    deliveryRepo: {
      ensurePending: vi.fn(),
      claim: vi.fn().mockResolvedValue([]),
      renewLease: vi.fn(),
      markSucceeded: vi.fn(),
      markSkipped: vi.fn(),
      replaySkippedForEventTypes: vi.fn(),
      scheduleRetry: vi.fn(),
      deadLetter: vi.fn(),
      replay: vi.fn(),
      getById: vi.fn(),
      listDeadLettered: vi.fn(),
      oldestPendingAt: vi.fn().mockResolvedValue(null),
    },
    crmSyncService: {
      syncEvent: vi.fn(),
      getGatewayMetrics: vi.fn().mockReturnValue({ apiCreditsRemaining: null }),
    } as unknown as CrmSyncService,
    ...overrides,
  };
}

describe("processZohoProjector", () => {
  it("returns early when sync mode is off", async () => {
    const ctx = baseCtx({
      env: { ZOHO_CRM_SYNC_MODE: "off" } as never,
    });
    await processZohoProjector(ctx);
    expect(ctx.deliveryRepo?.claim).not.toHaveBeenCalled();
  });

  it("marks dry_run deliveries skipped without calling CRM sync", async () => {
    const ctx = baseCtx();
    ctx.domainEventReader.listLockedForProjector = vi.fn().mockResolvedValue([
      {
        id: 5,
        eventType: "user.registered",
        aggregateId: "u1",
        payload: {
          userId: "u1",
          email: "a@example.com",
          name: "A",
          source: "credential",
        },
        schemaVersion: 1,
      },
    ]);
    ctx.domainEventReader.getById = vi.fn().mockResolvedValue({
      id: 5,
      eventType: "user.registered",
      aggregateId: "u1",
      payload: {
        userId: "u1",
        email: "a@example.com",
        name: "A",
        source: "credential",
      },
      schemaVersion: 1,
    });
    const deliveryRepo = ctx.deliveryRepo;
    if (!deliveryRepo) throw new Error("missing deliveryRepo");
    deliveryRepo.claim = vi.fn().mockResolvedValue([
      {
        id: 99,
        consumer: "zoho",
        eventId: 5,
        status: "processing",
        attempts: 1,
        leaseExpiresAt: new Date(Date.now() + 60_000),
        nextRetryAt: null,
        idempotencyKey: "zoho:5",
        providerReference: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await processZohoProjector(ctx);

    expect(ctx.crmSyncService?.syncEvent).not.toHaveBeenCalled();
    expect(ctx.deliveryRepo?.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "dry_run" }),
    );
  });

  it("calls CRM sync on live mode for allowlisted events", async () => {
    const syncEvent = vi.fn().mockResolvedValue({
      outcome: "success",
      providerReference: "Leads:1:upsert",
    } satisfies CrmSyncResult);
    const ctx = baseCtx({
      env: {
        ZOHO_CRM_SYNC_MODE: "live",
        ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered",
        ZOHO_CRM_CURSOR_BATCH_SIZE: 100,
        ZOHO_CRM_TICK_TIME_BUDGET_MS: 2_000,
      } as never,
      crmSyncService: {
        syncEvent,
        getGatewayMetrics: vi.fn().mockReturnValue({ apiCreditsRemaining: 42 }),
      } as unknown as CrmSyncService,
    });
    ctx.domainEventReader.listLockedForProjector = vi.fn().mockResolvedValue([
      {
        id: 6,
        eventType: "user.registered",
        aggregateId: "u2",
        payload: {
          userId: "u2",
          email: "b@example.com",
          name: "B",
          source: "credential",
        },
        schemaVersion: 1,
      },
    ]);
    ctx.domainEventReader.getById = vi.fn().mockResolvedValue({
      id: 6,
      eventType: "user.registered",
      aggregateId: "u2",
      payload: {
        userId: "u2",
        email: "b@example.com",
        name: "B",
        source: "credential",
      },
      schemaVersion: 1,
    });
    const deliveryRepo = ctx.deliveryRepo;
    if (!deliveryRepo) throw new Error("missing deliveryRepo");
    deliveryRepo.claim = vi.fn().mockResolvedValue([
      {
        id: 100,
        consumer: "zoho",
        eventId: 6,
        status: "processing",
        attempts: 1,
        leaseExpiresAt: new Date(Date.now() + 60_000),
        nextRetryAt: null,
        idempotencyKey: "zoho:6",
        providerReference: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await processZohoProjector(ctx);

    expect(syncEvent).toHaveBeenCalled();
    expect(ctx.deliveryRepo?.markSucceeded).toHaveBeenCalled();
  });
});
