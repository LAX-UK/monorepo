import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmGateway } from "../crm-gateway.js";
import { CrmSubjectLifecycleHandler } from "./crm-subject-lifecycle-handler.js";

describe("CrmSubjectLifecycleHandler", () => {
  it("returns retryable error when deal delete fails during erasure", async () => {
    const linkRepo = {
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
      listActiveDealLinksBySubject: vi.fn().mockResolvedValue([
        {
          entityType: "deal",
          entityId: "deal-1",
          zohoModule: "Deals",
          zohoRecordId: "z-deal-1",
          subjectId: "sub-1",
          erasedAt: null,
          deletionRequestedAt: null,
          recyclePurgedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      tombstone: vi.fn(),
      tombstoneDealByZohoRecordId: vi.fn(),
      markRecyclePurged: vi.fn(),
      mergeSubjectLinks: vi.fn(),
      upsertLink: vi.fn(),
      markErased: vi.fn(),
      setDeletionRequested: vi.fn(),
      clearDeletionRequested: vi.fn(),
      isDeletionRequested: vi.fn(),
      isErased: vi.fn(),
      listActiveByEntityType: vi.fn(),
      listErasedWithRealZohoLinks: vi.fn(),
      reassignDealLinksSubjectId: vi.fn(),
    } satisfies ICrmRecordLinkRepository;

    const gateway = {
      deleteRecord: vi.fn().mockResolvedValue({
        status: "error",
        code: "DELETE_FAILED",
      }),
      purgeFromRecycleBin: vi.fn(),
      findDealIdsByContact: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      upsertMany: vi.fn(),
      updateById: vi.fn(),
      findByEmail: vi.fn(),
      executeCoql: vi.fn(),
      convertLead: vi.fn(),
      getMetrics: () => ({ apiCreditsRemaining: null }),
    } satisfies CrmGateway;

    const handler = new CrmSubjectLifecycleHandler({ gateway, linkRepo });
    const result = await handler.eraseSubject("sub-1");
    expect(result.outcome).toBe("retry");
    if (result.outcome === "retry") {
      expect(result.error).toBeInstanceOf(CrmGatewayError);
      expect((result.error as CrmGatewayError).retryable).toBe(true);
    }
  });

  it("records deletion requested as success", async () => {
    const setDeletionRequested = vi.fn().mockResolvedValue(undefined);
    const handler = new CrmSubjectLifecycleHandler({
      gateway: {
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
      },
      linkRepo: {
        setDeletionRequested,
        findByEntity: vi.fn(),
        upsertLink: vi.fn(),
        mergeSubjectLinks: vi.fn(),
        markErased: vi.fn(),
        tombstone: vi.fn(),
        tombstoneDealByZohoRecordId: vi.fn(),
        clearDeletionRequested: vi.fn(),
        isDeletionRequested: vi.fn(),
        markRecyclePurged: vi.fn(),
        isErased: vi.fn(),
        listActiveDealLinksBySubject: vi.fn(),
        listActiveByEntityType: vi.fn(),
        listErasedWithRealZohoLinks: vi.fn(),
        reassignDealLinksSubjectId: vi.fn(),
      },
    });
    const result = await handler.handleDeletionRequested("sub-1");
    expect(result.outcome).toBe("success");
    expect(setDeletionRequested).toHaveBeenCalled();
  });
});
