import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { CRM_FIELD } from "../crm-field-constants.js";
import type { CrmGateway } from "../crm-gateway.js";
import { CrmDealSyncHandler } from "./crm-deal-sync-handler.js";
import { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

function baseLinkRepo(overrides: Partial<ICrmRecordLinkRepository> = {}): ICrmRecordLinkRepository {
  return {
    findByEntity: vi.fn(),
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
    ...overrides,
  };
}

describe("CrmDealSyncHandler", () => {
  it("does not convert again when subject is already a Contact", async () => {
    const convertLead = vi.fn();
    const upsert = vi.fn().mockResolvedValue({
      module: "Deals",
      recordId: "deal-1",
      action: "upsert",
      status: "success",
    });
    const linkRepo = baseLinkRepo({
      findByEntity: vi.fn().mockResolvedValue({
        entityType: "subject",
        entityId: "sub-1",
        zohoModule: "Contacts",
        zohoRecordId: "contact-1",
        subjectId: null,
        erasedAt: null,
        deletionRequestedAt: null,
        recyclePurgedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      upsertLink: vi.fn(),
    });

    const gateway = {
      upsert,
      upsertMany: vi.fn(),
      updateById: vi.fn(),
      findByEmail: vi.fn(),
      findDealIdsByContact: vi.fn(),
      executeCoql: vi.fn(),
      convertLead,
      deleteRecord: vi.fn(),
      purgeFromRecycleBin: vi.fn(),
      getMetrics: () => ({ apiCreditsRemaining: null }),
    } satisfies CrmGateway;

    const handler = new CrmDealSyncHandler({
      gateway,
      linkRepo,
      personHandler: new CrmPersonSyncHandler({ gateway, linkRepo }),
      leadConversionEnabled: true,
    });

    const result = await handler.convertLeadAndCreateDeal({
      kind: "convert_lead_on_win",
      subjectId: "sub-1",
      dealEntityId: "deal-key-1",
      dealKey: "lot-won:lot-1",
      dealFields: {
        [CRM_FIELD.dealExternalKey]: "lot-won:lot-1",
        Stage: "Won",
      },
    });

    expect(result.outcome).toBe("success");
    expect(convertLead).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();
  });

  it("creates deal without Contact_Name when conversion is disabled", async () => {
    const upsert = vi.fn().mockResolvedValue({
      module: "Deals",
      recordId: "deal-1",
      action: "upsert",
      status: "success",
    });
    const linkRepo = baseLinkRepo({
      findByEntity: vi.fn().mockResolvedValue({
        entityType: "subject",
        entityId: "sub-1",
        zohoModule: "Leads",
        zohoRecordId: "lead-1",
        subjectId: null,
        erasedAt: null,
        deletionRequestedAt: null,
        recyclePurgedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      upsertLink: vi.fn(),
    });
    const gateway = {
      upsert,
      upsertMany: vi.fn(),
      updateById: vi.fn(),
      findByEmail: vi.fn(),
      findDealIdsByContact: vi.fn(),
      executeCoql: vi.fn(),
      convertLead: vi.fn(),
      deleteRecord: vi.fn(),
      purgeFromRecycleBin: vi.fn(),
      getMetrics: () => ({ apiCreditsRemaining: null }),
    } satisfies CrmGateway;

    const handler = new CrmDealSyncHandler({
      gateway,
      linkRepo,
      personHandler: new CrmPersonSyncHandler({ gateway, linkRepo }),
      leadConversionEnabled: false,
    });

    const result = await handler.convertLeadAndCreateDeal({
      kind: "convert_lead_on_win",
      subjectId: "sub-1",
      dealEntityId: "lot-won:lot-1",
      dealKey: "lot-won:lot-1",
      dealFields: { [CRM_FIELD.dealExternalKey]: "lot-won:lot-1", Stage: "Won" },
    });

    expect(result.outcome).toBe("success");
    expect(gateway.convertLead).not.toHaveBeenCalled();
    const fields = upsert.mock.calls[0]?.[0]?.fields as Record<string, unknown>;
    expect(fields.Contact_Name).toBeUndefined();
  });

  it("creates deal without Contact when conversion enabled but subject has no Lead link", async () => {
    const upsert = vi.fn().mockResolvedValue({
      module: "Deals",
      recordId: "deal-1",
      action: "upsert",
      status: "success",
    });
    const linkRepo = baseLinkRepo({
      findByEntity: vi.fn().mockResolvedValue(null),
      upsertLink: vi.fn(),
    });
    const gateway = {
      upsert,
      upsertMany: vi.fn(),
      updateById: vi.fn(),
      findByEmail: vi.fn(),
      findDealIdsByContact: vi.fn(),
      executeCoql: vi.fn(),
      convertLead: vi.fn(),
      deleteRecord: vi.fn(),
      purgeFromRecycleBin: vi.fn(),
      getMetrics: () => ({ apiCreditsRemaining: null }),
    } satisfies CrmGateway;

    const handler = new CrmDealSyncHandler({
      gateway,
      linkRepo,
      personHandler: new CrmPersonSyncHandler({ gateway, linkRepo }),
      leadConversionEnabled: true,
    });

    const result = await handler.convertLeadAndCreateDeal({
      kind: "convert_lead_on_win",
      subjectId: "sub-new",
      dealEntityId: "lot-won:lot-1",
      dealKey: "lot-won:lot-1",
      dealFields: { [CRM_FIELD.dealExternalKey]: "lot-won:lot-1", Stage: "Won" },
    });

    expect(result.outcome).toBe("success");
    expect(gateway.convertLead).not.toHaveBeenCalled();
    const fields = upsert.mock.calls[0]?.[0]?.fields as Record<string, unknown>;
    expect(fields.Contact_Name).toBeUndefined();
  });

  it("skips deal stage update when subject is deletion-requested", async () => {
    const linkRepo = baseLinkRepo({
      findByEntity: vi.fn().mockResolvedValue({
        entityType: "deal",
        entityId: "lot-won:lot-1",
        zohoModule: "Deals",
        zohoRecordId: "deal-1",
        subjectId: "sub-1",
        erasedAt: null,
        deletionRequestedAt: null,
        recyclePurgedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      isDeletionRequested: vi.fn().mockResolvedValue(true),
    });
    const gateway = {
      upsert: vi.fn(),
      upsertMany: vi.fn(),
      updateById: vi.fn(),
      findByEmail: vi.fn(),
      findDealIdsByContact: vi.fn(),
      executeCoql: vi.fn(),
      convertLead: vi.fn(),
      deleteRecord: vi.fn(),
      purgeFromRecycleBin: vi.fn(),
      getMetrics: () => ({ apiCreditsRemaining: null }),
    } satisfies CrmGateway;

    const handler = new CrmDealSyncHandler({
      gateway,
      linkRepo,
      personHandler: new CrmPersonSyncHandler({ gateway, linkRepo }),
      leadConversionEnabled: false,
    });

    const result = await handler.updateDealStage("lot-won:lot-1", "Paid");
    expect(result).toEqual({ outcome: "skipped", reason: "deletion_requested" });
    expect(gateway.updateById).not.toHaveBeenCalled();
  });

  it("skips when subject is deletion-requested", async () => {
    const linkRepo = baseLinkRepo({
      isDeletionRequested: vi.fn().mockResolvedValue(true),
    });
    const gateway = {
      upsert: vi.fn(),
      upsertMany: vi.fn(),
      updateById: vi.fn(),
      findByEmail: vi.fn(),
      findDealIdsByContact: vi.fn(),
      executeCoql: vi.fn(),
      convertLead: vi.fn(),
      deleteRecord: vi.fn(),
      purgeFromRecycleBin: vi.fn(),
      getMetrics: () => ({ apiCreditsRemaining: null }),
    } satisfies CrmGateway;

    const handler = new CrmDealSyncHandler({
      gateway,
      linkRepo,
      personHandler: new CrmPersonSyncHandler({ gateway, linkRepo }),
      leadConversionEnabled: true,
    });

    const result = await handler.syncDeal({
      kind: "deal_upsert",
      subjectId: "sub-1",
      dealEntityId: "shop-order:o1",
      dealKey: "shop-order:o1",
      fields: { Deal_Name: "Shop" },
    });
    expect(result).toEqual({ outcome: "skipped", reason: "deletion_requested" });
  });
});
