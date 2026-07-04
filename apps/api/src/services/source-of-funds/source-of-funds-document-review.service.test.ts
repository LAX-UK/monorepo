import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  SOURCE_OF_FUNDS_DOCUMENT_REVIEWED_EVENT,
  SourceOfFundsDocumentReviewService,
} from "./source-of-funds-document-review.service.js";

describe("SourceOfFundsDocumentReviewService", () => {
  const mockTransaction = vi.fn();
  const mockDb = { transaction: mockTransaction } as never;
  const publish = vi.fn().mockResolvedValue(undefined);
  const events = mockDomainEventSink(publish);

  let caseRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let docRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let reviewRepo: {
    upsertLatest: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    caseRepo = {
      findById: vi.fn().mockResolvedValue({
        id: "sof-1",
        status: "pending",
      }),
    };
    docRepo = {
      findById: vi.fn().mockResolvedValue({
        id: "doc-1",
        sourceOfFundsId: "sof-1",
        reviewStatus: "active",
      }),
    };
    reviewRepo = {
      upsertLatest: vi.fn().mockResolvedValue({
        documentId: "doc-1",
        sourceOfFundsId: "sof-1",
        reviewedByUserId: "staff-1",
        reviewedAt: new Date("2026-01-04T10:00:00.000Z"),
        checks: {
          matchesDeclaredSource: true,
          coversExposure: false,
          recentEnough: true,
          legibleComplete: true,
        },
        note: null,
      }),
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
  });

  function makeSvc() {
    return new SourceOfFundsDocumentReviewService(
      caseRepo as never,
      docRepo as never,
      reviewRepo as never,
      transactionRunnerFromDb(mockDb),
      events,
    );
  }

  it("rejects review when case is not pending", async () => {
    caseRepo.findById.mockResolvedValue({ id: "sof-1", status: "approved" });
    const svc = makeSvc();
    await expect(
      svc.reviewDocument({
        caseId: "sof-1",
        documentId: "doc-1",
        staffUserId: "staff-1",
        checks: {},
        note: null,
      }),
    ).rejects.toThrow("source_of_funds_not_pending");
  });

  it("rejects superseded documents", async () => {
    docRepo.findById.mockResolvedValue({
      id: "doc-1",
      sourceOfFundsId: "sof-1",
      reviewStatus: "superseded",
    });
    const svc = makeSvc();
    await expect(
      svc.reviewDocument({
        caseId: "sof-1",
        documentId: "doc-1",
        staffUserId: "staff-1",
        checks: {},
        note: null,
      }),
    ).rejects.toThrow("source_of_funds_document_superseded");
  });

  it("publishes document_reviewed once per save", async () => {
    const svc = makeSvc();
    await svc.reviewDocument({
      caseId: "sof-1",
      documentId: "doc-1",
      staffUserId: "staff-1",
      checks: { matchesDeclaredSource: true },
      note: "Looks good",
    });

    expect(reviewRepo.upsertLatest).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      eventType: SOURCE_OF_FUNDS_DOCUMENT_REVIEWED_EVENT,
      aggregateId: "sof-1",
    });
  });
});
