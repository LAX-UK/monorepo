import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import type { CrmGateway } from "./crm-gateway.js";
import type { CrmAttributionReader, CrmPaymentLotReader } from "./crm-readers.js";
import { CrmSyncService } from "./crm-sync-service.js";

function baseEnv(): WorkerEnv {
  return {
    ZOHO_CRM_LEAD_CONVERSION_ENABLED: false,
    ZOHO_CRM_SYNC_MODE: "live",
    ZOHO_CRM_ENABLED_EVENT_TYPES: "payment.refunded",
    ZOHO_CRM_AUCTION_PIPELINE: "Auction",
    ZOHO_CRM_DEAL_STAGE_LOT_WON: "Won",
    ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED: "Paid",
    ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED: "Refunded",
    ZOHO_CRM_DEAL_STAGE_SHOP_PAID: "Shop Paid",
  } as WorkerEnv;
}

function baseGateway(): CrmGateway {
  return {
    upsert: vi.fn(),
    upsertMany: vi.fn(),
    updateById: vi.fn().mockResolvedValue({
      module: "Deals",
      recordId: "deal-1",
      action: "update",
      status: "success",
    }),
    findByEmail: vi.fn(),
    findDealIdsByContact: vi.fn(),
    executeCoql: vi.fn(),
    convertLead: vi.fn(),
    deleteRecord: vi.fn(),
    purgeFromRecycleBin: vi.fn(),
    getMetrics: () => ({ apiCreditsRemaining: null }),
  };
}

function baseLinkRepo(): ICrmRecordLinkRepository {
  return {
    findByEntity: vi.fn().mockResolvedValue({
      entityType: "deal",
      entityId: "lot-won:lot-1",
      zohoModule: "Deals",
      zohoRecordId: "deal-1",
      subjectId: "user-1",
      erasedAt: null,
      deletionRequestedAt: null,
      recyclePurgedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    upsertLink: vi.fn(),
    mergeSubjectLinks: vi.fn(),
    markErased: vi.fn(),
    tombstone: vi.fn(),
    tombstoneDealByZohoRecordId: vi.fn(),
    setDeletionRequested: vi.fn(),
    clearDeletionRequested: vi.fn(),
    isDeletionRequested: vi.fn().mockResolvedValue(false),
    markRecyclePurged: vi.fn(),
    isErased: vi.fn().mockResolvedValue(false),
    listActiveDealLinksBySubject: vi.fn().mockResolvedValue([]),
    listActiveByEntityType: vi.fn(),
    listErasedWithRealZohoLinks: vi.fn(),
    reassignDealLinksSubjectId: vi.fn(),
  };
}

describe("CrmSyncService payment.refunded", () => {
  it("skips when lot id cannot be resolved", async () => {
    const paymentLotReader: CrmPaymentLotReader = {
      findLotIdForPayment: vi.fn().mockResolvedValue(null),
    };
    const service = new CrmSyncService({
      gateway: baseGateway(),
      linkRepo: baseLinkRepo(),
      env: baseEnv(),
      mapperContext: {
        auctionPipeline: "Auction",
        dealStageLotWon: "Won",
        dealStagePaymentCaptured: "Paid",
        dealStagePaymentRefunded: "Refunded",
        dealStageShopPaid: "Shop Paid",
        dealStageShopEnquiry: "Qualification",
      },
      paymentLotReader,
      attributionReader: { loadFirstTouchFields: vi.fn() } satisfies CrmAttributionReader,
    });

    const result = await service.syncEvent({
      id: 1,
      eventType: "payment.refunded",
      aggregateId: "pay-1",
      schemaVersion: 1,
      payload: {
        amount: "10.00",
        currency: "GBP",
        sellerLegalEntityId: null,
        via: "admin_manual",
        stripeRefundId: "re_1",
      },
    });

    expect(result).toEqual({ outcome: "skipped", reason: "payment_refund_missing_lot" });
  });

  it("maps refund stage when lot id comes from payment reader", async () => {
    const gateway = baseGateway();
    const paymentLotReader: CrmPaymentLotReader = {
      findLotIdForPayment: vi.fn().mockResolvedValue("22222222-2222-4222-8222-222222222222"),
    };
    const service = new CrmSyncService({
      gateway,
      linkRepo: baseLinkRepo(),
      env: baseEnv(),
      mapperContext: {
        auctionPipeline: "Auction",
        dealStageLotWon: "Won",
        dealStagePaymentCaptured: "Paid",
        dealStagePaymentRefunded: "Refunded",
        dealStageShopPaid: "Shop Paid",
        dealStageShopEnquiry: "Qualification",
      },
      paymentLotReader,
      attributionReader: { loadFirstTouchFields: vi.fn() } satisfies CrmAttributionReader,
    });

    const result = await service.syncEvent({
      id: 2,
      eventType: "payment.refunded",
      aggregateId: "pay-1",
      schemaVersion: 1,
      payload: {
        stripeChargeId: "ch_1",
        amountCents: 100,
        cumulativeRefundedCents: 100,
        currency: "gbp",
        sellerLegalEntityId: "33333333-3333-4333-8333-333333333333",
        via: "stripe_webhook",
      },
    });

    expect(result.outcome).toBe("success");
    expect(gateway.updateById).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: { Stage: "Refunded" },
      }),
    );
  });
});
