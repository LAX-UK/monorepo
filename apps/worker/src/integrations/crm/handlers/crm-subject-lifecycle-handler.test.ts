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
      listActiveSubjectLinksByZohoRecord: vi.fn().mockResolvedValue([]),
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

  it("deletes and purges every deal of an erased person, so the surname in its name goes too", async () => {
    const dealLink = (id: string) => ({
      entityType: "deal",
      entityId: `deal-${id}`,
      zohoModule: "Deals",
      zohoRecordId: `z-deal-${id}`,
      subjectId: "sub-1",
      erasedAt: null,
      deletionRequestedAt: null,
      recyclePurgedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
      listActiveDealLinksBySubject: vi.fn().mockResolvedValue([dealLink("1")]),
      listActiveSubjectLinksByZohoRecord: vi.fn().mockResolvedValue([]),
      tombstone: vi.fn(),
      tombstoneDealByZohoRecordId: vi.fn(),
      markRecyclePurged: vi.fn(),
    };
    const gateway = {
      deleteRecord: vi.fn().mockResolvedValue({ status: "success" }),
      purgeFromRecycleBin: vi.fn().mockResolvedValue(undefined),
      // A deal made in the CRM itself, found through the contact.
      findDealIdsByContact: vi.fn().mockResolvedValue(["z-deal-2"]),
    };
    const handler = new CrmSubjectLifecycleHandler({
      gateway: gateway as unknown as CrmGateway,
      linkRepo: linkRepo as unknown as ICrmRecordLinkRepository,
    });
    const result = await handler.eraseSubject("sub-1");
    expect(result.outcome).toBe("success");
    const deleted = gateway.deleteRecord.mock.calls.map(([arg]) => arg);
    expect(deleted).toEqual(
      expect.arrayContaining([
        { module: "Deals", recordId: "z-deal-1" },
        { module: "Deals", recordId: "z-deal-2" },
      ]),
    );
    expect(gateway.purgeFromRecycleBin).toHaveBeenCalledWith("z-deal-1");
    expect(gateway.purgeFromRecycleBin).toHaveBeenCalledWith("z-deal-2");
    expect(linkRepo.tombstoneDealByZohoRecordId).toHaveBeenCalledWith("z-deal-1");
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
        listActiveSubjectLinksByZohoRecord: vi.fn().mockResolvedValue([]),
        listActiveByEntityType: vi.fn(),
        listErasedWithRealZohoLinks: vi.fn(),
        reassignDealLinksSubjectId: vi.fn(),
      },
    });
    const result = await handler.handleDeletionRequested("sub-1");
    expect(result.outcome).toBe("success");
    expect(setDeletionRequested).toHaveBeenCalled();
  });

  describe("erasing a person whose enquiries created the lead", () => {
    const linkRow = (entityId: string, zohoRecordId = "lead-1", erasedAt: Date | null = null) => ({
      entityType: "subject",
      entityId,
      zohoModule: "Leads",
      zohoRecordId,
      subjectId: null,
      erasedAt,
      deletionRequestedAt: null,
      recyclePurgedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    function build(options: {
      links: Record<string, ReturnType<typeof linkRow>>;
      sharing?: ReturnType<typeof linkRow>[];
      deleteResult?: { status: "deleted" | "already_deleted" } | { status: "error"; code: string };
    }) {
      const linkRepo = {
        findByEntity: vi.fn(async (_type: string, id: string) => options.links[id] ?? null),
        listActiveDealLinksBySubject: vi.fn().mockResolvedValue([]),
        listActiveSubjectLinksByZohoRecord: vi.fn().mockResolvedValue(options.sharing ?? []),
        tombstone: vi.fn().mockResolvedValue(undefined),
        markRecyclePurged: vi.fn().mockResolvedValue(undefined),
      };
      const gateway = {
        deleteRecord: vi.fn().mockResolvedValue(options.deleteResult ?? { status: "deleted" }),
        purgeFromRecycleBin: vi.fn().mockResolvedValue(undefined),
        findDealIdsByContact: vi.fn().mockResolvedValue([]),
      };
      const handler = new CrmSubjectLifecycleHandler({
        gateway: gateway as unknown as CrmGateway,
        linkRepo: linkRepo as unknown as ICrmRecordLinkRepository,
      });
      return { handler, gateway, linkRepo };
    }

    it("deletes the shared lead once, empties the recycle bin and marks every enquiry subject erased", async () => {
      const { handler, gateway, linkRepo } = build({
        links: { "guest:g1": linkRow("guest:g1") },
        sharing: [linkRow("guest:g1"), linkRow("enquiry:e1"), linkRow("enquiry:e2")],
      });
      const result = await handler.eraseSubject("guest:g1");
      expect(result.outcome).toBe("success");
      expect(gateway.deleteRecord).toHaveBeenCalledTimes(1);
      expect(gateway.deleteRecord).toHaveBeenCalledWith({ module: "Leads", recordId: "lead-1" });
      expect(gateway.purgeFromRecycleBin).toHaveBeenCalledWith("lead-1");
      const erased = linkRepo.tombstone.mock.calls.map(([input]) => input.entityId);
      expect(erased.sort()).toEqual(["enquiry:e1", "enquiry:e2", "guest:g1"]);
    });

    it("counts a lead already deleted in Zoho as done", async () => {
      const { handler, linkRepo } = build({
        links: { "user-1": linkRow("user-1") },
        sharing: [linkRow("user-1"), linkRow("enquiry:e1")],
        deleteResult: { status: "already_deleted" },
      });
      const result = await handler.eraseSubject("user-1");
      expect(result.outcome).toBe("success");
      expect(linkRepo.tombstone).toHaveBeenCalledTimes(2);
    });

    it("keeps the enquiry subjects linked when the delete fails, so the retry finds them", async () => {
      const { handler, linkRepo } = build({
        links: { "user-1": linkRow("user-1") },
        sharing: [linkRow("user-1"), linkRow("enquiry:e1")],
        deleteResult: { status: "error", code: "INTERNAL_ERROR" },
      });
      const result = await handler.eraseSubject("user-1");
      expect(result.outcome).toBe("retry");
      expect(linkRepo.tombstone).not.toHaveBeenCalled();
    });

    it("makes no call when the person has no lead", async () => {
      const { handler, gateway, linkRepo } = build({ links: {} });
      const result = await handler.eraseSubject("guest:none");
      expect(result).toEqual({ outcome: "skipped", reason: "subject_already_erased" });
      expect(gateway.deleteRecord).not.toHaveBeenCalled();
      expect(gateway.purgeFromRecycleBin).not.toHaveBeenCalled();
      expect(linkRepo.listActiveSubjectLinksByZohoRecord).not.toHaveBeenCalled();
    });

    it("makes no call when the lead was erased already", async () => {
      const { handler, gateway } = build({
        links: { "user-1": linkRow("user-1", "lead-1", new Date()) },
      });
      const result = await handler.eraseSubject("user-1");
      expect(result.outcome).toBe("skipped");
      expect(gateway.deleteRecord).not.toHaveBeenCalled();
    });
  });
});
