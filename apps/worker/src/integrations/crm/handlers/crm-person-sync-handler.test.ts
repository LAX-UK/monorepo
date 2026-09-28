import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmGateway } from "../crm-gateway.js";
import { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

function linkRepo(overrides: Partial<ICrmRecordLinkRepository> = {}): ICrmRecordLinkRepository {
  return {
    findByEntity: vi.fn().mockResolvedValue(null),
    upsertLink: vi.fn().mockResolvedValue(undefined),
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

function gateway(overrides: Partial<CrmGateway> = {}): CrmGateway {
  return {
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
    ...overrides,
  };
}

describe("CrmPersonSyncHandler", () => {
  it("returns retry when patch mode has no link", async () => {
    const handler = new CrmPersonSyncHandler({
      gateway: gateway(),
      linkRepo: linkRepo({ findByEntity: vi.fn().mockResolvedValue(null) }),
    });
    const result = await handler.syncPerson("sub-1", "a@b.com", { Email: "a@b.com" }, "patch");
    expect(result.outcome).toBe("retry");
    if (result.outcome === "retry") {
      expect(result.error).toBeInstanceOf(CrmGatewayError);
      expect((result.error as CrmGatewayError).retryable).toBe(true);
    }
  });

  it("runs stale-link recovery only once", async () => {
    const updateById = vi
      .fn()
      .mockResolvedValueOnce({
        module: "Leads",
        recordId: "lead-1",
        action: "update",
        status: "error",
        code: "INVALID_DATA",
      })
      .mockResolvedValueOnce({
        module: "Leads",
        recordId: "lead-1",
        action: "update",
        status: "success",
      });
    const findByEmail = vi.fn().mockResolvedValue({ module: "Leads", recordId: "lead-1" });
    const upsertLink = vi.fn().mockResolvedValue(undefined);
    const handler = new CrmPersonSyncHandler({
      gateway: gateway({ updateById, findByEmail }),
      linkRepo: linkRepo({
        findByEntity: vi.fn().mockResolvedValue({
          entityType: "subject",
          entityId: "sub-1",
          zohoModule: "Leads",
          zohoRecordId: "stale",
          subjectId: null,
          erasedAt: null,
          deletionRequestedAt: null,
          recyclePurgedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        upsertLink,
      }),
    });
    const result = await handler.syncPerson("sub-1", "a@b.com", { Email: "a@b.com" }, "patch");
    expect(result.outcome).toBe("success");
    expect(findByEmail).toHaveBeenCalledTimes(1);
    expect(updateById).toHaveBeenCalledTimes(2);
  });
});
