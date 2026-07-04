import type { ISourceOfFundsDocumentReviewRepository } from "@auction/persistence";
import type { ISourceOfFundsDocumentRepository } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { PerRequestSigningPolicy } from "../signed-url-policy.js";
import {
  SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
  SourceOfFundsDocumentCollectionService,
  clampStaffPreviewContentType,
} from "./source-of-funds-document-collection.service.js";
import type { SourceOfFundsSettlementReadService } from "./source-of-funds-settlement-read.service.js";
import type {
  ISourceOfFundsRepository,
  SourceOfFundsCase,
  SourceOfFundsDocumentRow,
} from "./source-of-funds.types.js";

function makeSettlementReadMock(): SourceOfFundsSettlementReadService {
  return {
    summarizeForBuyersBatch: vi.fn().mockResolvedValue(new Map()),
    listSettlementItemsForBuyer: vi.fn().mockResolvedValue([]),
    sumActivePaymentExposurePence: vi.fn().mockResolvedValue(0),
    listBlockedPaymentsForBuyer: vi.fn().mockResolvedValue([]),
  } as unknown as SourceOfFundsSettlementReadService;
}

function makeCase(
  partial: Partial<SourceOfFundsCase> & Pick<SourceOfFundsCase, "id" | "userId">,
): SourceOfFundsCase {
  return {
    status: "pending",
    trigger: "threshold",
    thresholdAmount: "9000.00",
    exposureAmount: "9000.00",
    currency: "GBP",
    declaredSource: null,
    evidence: [],
    documentsRequestedAt: new Date("2026-06-01T00:00:00Z"),
    documentsRequestedByUserId: "staff-1",
    documentRequestNote: "Please upload bank statements",
    requestedDocumentTypes: ["bank_statement"],
    documentsSubmittedAt: null,
    triageRecommendation: null,
    triagedByUserId: null,
    triagedAt: null,
    triageNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...partial,
  };
}

function makeDoc(partial: Partial<SourceOfFundsDocumentRow>): SourceOfFundsDocumentRow {
  return {
    id: "doc-1",
    sourceOfFundsId: "sof-1",
    uploadObjectId: "up-1",
    requestedType: "bank_statement",
    label: null,
    reviewStatus: "pending",
    retentionClass: "aml_5y",
    uploadedByUserId: "buyer-1",
    uploadedAt: new Date("2026-06-02T00:00:00Z"),
    supersededAt: null,
    anonymizedAt: null,
    fileName: "statement.pdf",
    ...partial,
  };
}

describe("SourceOfFundsDocumentCollectionService", () => {
  it("attachDocument rejects non-owner buyers", async () => {
    const caseRecord = makeCase({ id: "sof-1", userId: "buyer-1" });
    const caseRepo: ISourceOfFundsRepository = {
      findById: vi.fn().mockResolvedValue(caseRecord),
    } as never;
    const service = new SourceOfFundsDocumentCollectionService(
      caseRepo,
      {} as ISourceOfFundsDocumentRepository,
      {} as ISourceOfFundsDocumentReviewRepository,
      { findKey: vi.fn().mockResolvedValue(null) } as never,
      { runInTransaction: async (fn: (tx: unknown) => unknown) => fn({}) } as never,
      null,
      {} as never,
      new PerRequestSigningPolicy(90),
      makeSettlementReadMock(),
    );

    await expect(
      service.attachDocument({
        caseId: "sof-1",
        buyerUserId: "other-buyer",
        uploadObjectId: "up-1",
        requestedType: "bank_statement",
        label: null,
      }),
    ).rejects.toThrow("source_of_funds_forbidden");
  });

  it("attachDocument supersedes prior active document of the same type", async () => {
    const caseRecord = makeCase({ id: "sof-1", userId: "buyer-1" });
    const supersede = vi.fn().mockResolvedValue([]);
    const attach = vi.fn().mockResolvedValue(makeDoc({ id: "doc-2" }));
    const deleteForDocuments = vi.fn().mockResolvedValue(undefined);
    const docRepo: ISourceOfFundsDocumentRepository = {
      supersedeActiveForType: supersede,
      attach,
    } as never;
    const reviewRepo: ISourceOfFundsDocumentReviewRepository = {
      deleteForDocuments,
    } as never;

    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "up-1", status: "active", kind: "source_of_funds_document" },
            ]),
        }),
      }),
    };
    const conn = { select: vi.fn().mockReturnValue(selectChain) };
    const caseRepo: ISourceOfFundsRepository = {
      findById: vi.fn().mockResolvedValue(caseRecord),
    } as never;

    const service = new SourceOfFundsDocumentCollectionService(
      caseRepo,
      docRepo,
      reviewRepo,
      { findKey: vi.fn().mockResolvedValue(null) } as never,
      { runInTransaction: async (fn: (tx: unknown) => unknown) => fn(conn) } as never,
      null,
      {} as never,
      new PerRequestSigningPolicy(90),
      makeSettlementReadMock(),
    );

    await service.attachDocument({
      caseId: "sof-1",
      buyerUserId: "buyer-1",
      uploadObjectId: "up-1",
      requestedType: "bank_statement",
      label: "June statement",
    });

    expect(supersede).toHaveBeenCalledWith("sof-1", "bank_statement", conn);
    expect(deleteForDocuments).not.toHaveBeenCalled();
    expect(attach).toHaveBeenCalled();
  });

  it("attachDocument deletes staff reviews for superseded documents", async () => {
    const caseRecord = makeCase({ id: "sof-1", userId: "buyer-1" });
    const supersede = vi.fn().mockResolvedValue(["doc-old"]);
    const attach = vi.fn().mockResolvedValue(makeDoc({ id: "doc-2" }));
    const deleteForDocuments = vi.fn().mockResolvedValue(undefined);
    const docRepo: ISourceOfFundsDocumentRepository = {
      supersedeActiveForType: supersede,
      attach,
    } as never;
    const reviewRepo: ISourceOfFundsDocumentReviewRepository = {
      deleteForDocuments,
    } as never;

    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "up-1", status: "active", kind: "source_of_funds_document" },
            ]),
        }),
      }),
    };
    const conn = { select: vi.fn().mockReturnValue(selectChain) };
    const caseRepo: ISourceOfFundsRepository = {
      findById: vi.fn().mockResolvedValue(caseRecord),
    } as never;

    const service = new SourceOfFundsDocumentCollectionService(
      caseRepo,
      docRepo,
      reviewRepo,
      { findKey: vi.fn().mockResolvedValue(null) } as never,
      { runInTransaction: async (fn: (tx: unknown) => unknown) => fn(conn) } as never,
      null,
      {} as never,
      new PerRequestSigningPolicy(90),
      makeSettlementReadMock(),
    );

    await service.attachDocument({
      caseId: "sof-1",
      buyerUserId: "buyer-1",
      uploadObjectId: "up-1",
      requestedType: "bank_statement",
      label: "June statement",
    });

    expect(deleteForDocuments).toHaveBeenCalledWith(["doc-old"], conn);
  });

  it("requestDocuments rejects when documents were already requested", async () => {
    const caseRecord = makeCase({
      id: "sof-1",
      userId: "buyer-1",
      documentsRequestedAt: new Date("2026-06-01T00:00:00Z"),
      documentsSubmittedAt: null,
    });
    const setDocumentRequest = vi.fn();
    const caseRepo: ISourceOfFundsRepository = {
      findById: vi.fn().mockResolvedValue(caseRecord),
      setDocumentRequest,
    } as never;

    const service = new SourceOfFundsDocumentCollectionService(
      caseRepo,
      {} as ISourceOfFundsDocumentRepository,
      {} as ISourceOfFundsDocumentReviewRepository,
      { findKey: vi.fn().mockResolvedValue(null) } as never,
      { runInTransaction: async (fn: (tx: unknown) => unknown) => fn({}) } as never,
      null,
      {} as never,
      new PerRequestSigningPolicy(90),
      makeSettlementReadMock(),
    );

    await expect(
      service.requestDocuments({
        caseId: "sof-1",
        staffUserId: "staff-1",
        documentTypes: ["bank_statement"],
        note: null,
      }),
    ).rejects.toThrow("source_of_funds_documents_already_requested");
    expect(setDocumentRequest).not.toHaveBeenCalled();
  });

  it("getStaffDownloadUrl uses short-TTL presigned GET and emits audit event", async () => {
    const caseRecord = makeCase({ id: "sof-1", userId: "buyer-1" });
    const doc = makeDoc({ id: "doc-1", sourceOfFundsId: "sof-1" });
    const createPresignedGet = vi.fn().mockResolvedValue({ url: "https://signed.example/doc" });
    const publish = vi.fn().mockResolvedValue(undefined);

    const service = new SourceOfFundsDocumentCollectionService(
      { findById: vi.fn().mockResolvedValue(caseRecord) } as never,
      { findById: vi.fn().mockResolvedValue(doc) } as never,
      {} as ISourceOfFundsDocumentReviewRepository,
      { findKey: vi.fn().mockResolvedValue("uploads/active/source-of-funds/x.pdf") } as never,
      { runInTransaction: async (fn: (tx: unknown) => Promise<void>) => fn({}) } as never,
      { publish } as never,
      { createPresignedGet } as never,
      new PerRequestSigningPolicy(90),
      makeSettlementReadMock(),
    );

    const result = await service.getStaffDownloadUrl({
      caseId: "sof-1",
      documentId: "doc-1",
      staffUserId: "staff-2",
      clientIp: "203.0.113.10",
    });

    expect(result?.url).toBe("https://signed.example/doc");
    expect(createPresignedGet).toHaveBeenCalledWith({
      key: "uploads/active/source-of-funds/x.pdf",
      expiresInSec: 90,
      responseContentDisposition: 'attachment; filename="statement.pdf"',
    });
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: SOURCE_OF_FUNDS_DOCUMENT_DOWNLOADED_EVENT,
        actorUserId: "staff-2",
        payload: expect.objectContaining({
          documentId: "doc-1",
          clientIp: "203.0.113.10",
        }),
      }),
    );
  });

  it("getStaffDownloadUrl rejects superseded documents", async () => {
    const caseRecord = makeCase({ id: "sof-1", userId: "buyer-1" });
    const doc = makeDoc({
      id: "doc-1",
      sourceOfFundsId: "sof-1",
      reviewStatus: "superseded",
    });
    const createPresignedGet = vi.fn();

    const service = new SourceOfFundsDocumentCollectionService(
      { findById: vi.fn().mockResolvedValue(caseRecord) } as never,
      { findById: vi.fn().mockResolvedValue(doc) } as never,
      {} as ISourceOfFundsDocumentReviewRepository,
      { findKey: vi.fn() } as never,
      { runInTransaction: async (fn: (tx: unknown) => unknown) => fn({}) } as never,
      { publish: vi.fn() } as never,
      { createPresignedGet } as never,
      new PerRequestSigningPolicy(90),
      makeSettlementReadMock(),
    );

    const result = await service.getStaffDownloadUrl({
      caseId: "sof-1",
      documentId: "doc-1",
      staffUserId: "staff-2",
    });

    expect(result).toBeNull();
    expect(createPresignedGet).not.toHaveBeenCalled();
  });

  it("clampStaffPreviewContentType allows pdf and images only", () => {
    expect(clampStaffPreviewContentType("application/pdf")).toBe("application/pdf");
    expect(clampStaffPreviewContentType("image/png")).toBe("image/png");
    expect(clampStaffPreviewContentType("text/html")).toBe("application/octet-stream");
    expect(clampStaffPreviewContentType("image/jpg")).toBe("image/jpeg");
  });
});
