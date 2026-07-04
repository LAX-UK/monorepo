import type { AdminUserListRow, IAdminUserReader } from "@auction/persistence/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { SourceOfFundsSettlementReadService } from "../source-of-funds/source-of-funds-settlement-read.service.js";
import type {
  ISourceOfFundsRepository,
  SourceOfFundsCase,
} from "../source-of-funds/source-of-funds.types.js";
import { AdminSourceOfFundsQueryService } from "./admin-source-of-funds-query.service.js";

function makeCase(
  partial: Partial<SourceOfFundsCase> & Pick<SourceOfFundsCase, "id" | "userId">,
): SourceOfFundsCase {
  return {
    status: "pending",
    trigger: "linked_transactions",
    thresholdAmount: "9000.00",
    exposureAmount: "12000.00",
    currency: "GBP",
    declaredSource: null,
    evidence: ["evidence/key.pdf"],
    documentsRequestedAt: null,
    documentsRequestedByUserId: null,
    documentRequestNote: null,
    requestedDocumentTypes: [],
    documentsSubmittedAt: null,
    triageRecommendation: null,
    triagedByUserId: null,
    triagedAt: null,
    triageNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...partial,
  };
}

describe("AdminSourceOfFundsQueryService", () => {
  let repo: ISourceOfFundsRepository;
  let docRepo: {
    listActiveForCase: ReturnType<typeof vi.fn>;
  } & Record<string, ReturnType<typeof vi.fn>>;
  let reviewRepo: {
    listForCase: ReturnType<typeof vi.fn>;
  };
  let adminUserReader: IAdminUserReader;
  let settlementRead: Pick<
    SourceOfFundsSettlementReadService,
    | "summarizeForBuyersBatch"
    | "listSettlementItemsForBuyer"
    | "sumActivePaymentExposurePence"
    | "listBlockedPaymentsForBuyer"
  >;
  let media: MediaUrlResolver;

  function makeSvc() {
    return new AdminSourceOfFundsQueryService(
      repo,
      docRepo as never,
      reviewRepo as never,
      adminUserReader,
      settlementRead as SourceOfFundsSettlementReadService,
      media,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    settlementRead = {
      summarizeForBuyersBatch: vi
        .fn()
        .mockResolvedValue(
          new Map([["user-1", { settlementSummary: "Lot 1 · Test Sale", settlementItemCount: 1 }]]),
        ),
      listSettlementItemsForBuyer: vi.fn().mockResolvedValue([]),
      sumActivePaymentExposurePence: vi.fn().mockResolvedValue(1_200_000),
      listBlockedPaymentsForBuyer: vi.fn().mockResolvedValue([]),
    };
    repo = {
      findLatestForUser: vi.fn(),
      findById: vi.fn(),
      findLatestApprovedForUser: vi.fn(),
      findPendingForUser: vi.fn(),
      listByStatus: vi.fn(),
      countByStatus: vi.fn(),
      create: vi.fn(),
      setTriage: vi.fn(),
      setReview: vi.fn(),
      reopenRejected: vi.fn(),
      setDocumentRequest: vi.fn(),
      setDocumentsSubmitted: vi.fn(),
      resetDocumentCycle: vi.fn(),
      sumActiveBuyerSettlementPence: vi.fn(),
      listForUser: vi.fn(),
      countPendingByUserIds: vi.fn().mockResolvedValue(new Map([["user-1", 1]])),
    };
    adminUserReader = {
      list: vi.fn(),
      getById: vi.fn(),
      getByIds: vi
        .fn()
        .mockResolvedValue([{ id: "user-1", email: "buyer@example.com", name: "Buyer One" }]),
    };
    docRepo = {
      listActiveForCase: vi.fn().mockResolvedValue([]),
      attach: vi.fn(),
      supersedeActiveForType: vi.fn(),
      listForCase: vi.fn(),
      findById: vi.fn(),
      countActiveForCase: vi.fn(),
    };
    reviewRepo = {
      listForCase: vi.fn().mockResolvedValue([]),
    };
    media = {
      resolve: vi.fn(),
      resolveMany: vi.fn(),
      resolveManyUnique: vi
        .fn()
        .mockResolvedValue(new Map([["evidence/key.pdf", "https://signed/url"]])),
    } as unknown as MediaUrlResolver;
  });

  it("returns null from getDetail when case is missing", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    const svc = makeSvc();
    await expect(svc.getDetail("missing")).resolves.toBeNull();
  });

  it("enriches list rows with buyer and settlement summary", async () => {
    const caseRow = makeCase({ id: "sof-1", userId: "user-1" });
    vi.mocked(repo.listByStatus).mockResolvedValue([caseRow]);
    vi.mocked(repo.countByStatus).mockResolvedValue(1);

    const svc = makeSvc();
    const { rows, total } = await svc.listEnriched("pending", 50, 0);

    expect(total).toBe(1);
    expect(rows[0]?.buyerLabel).toBe("Buyer One");
    expect(rows[0]?.settlementSummary).toBe("Lot 1 · Test Sale");
    expect(rows[0]?.settlementItemCount).toBe(1);
  });

  it("getDetail maps exposure fields and evidence downloads", async () => {
    const caseRow = makeCase({ id: "sof-1", userId: "user-1" });
    vi.mocked(repo.findById).mockResolvedValue(caseRow);
    vi.mocked(adminUserReader.getByIds).mockResolvedValue([
      { id: "user-1", email: "buyer@example.com", name: "" } as AdminUserListRow,
    ]);

    const svc = makeSvc();
    const detail = await svc.getDetail("sof-1");

    expect(detail).not.toBeNull();
    expect(detail?.exposureAtOpenPence).toBe(1_200_000);
    expect(detail?.currentActiveExposurePence).toBe(1_200_000);
    expect(detail?.buyer.label).toBe("buyer@example.com");
    expect(detail?.evidenceDownloads[0]?.downloadUrl).toBe("https://signed/url");
  });
});
