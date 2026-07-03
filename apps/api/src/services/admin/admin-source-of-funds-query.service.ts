import type { ISourceOfFundsDocumentReviewRepository } from "@auction/persistence";
import type {
  AdminSourceOfFundsDetailDto,
  AdminSourceOfFundsListRowDto,
} from "../../admin/admin-route-dtos.js";
import type { ISourceOfFundsDocumentRepository } from "../../repositories/drizzle-source-of-funds-document.repository.js";
import type { IAdminUserReader } from "../interfaces/admin-user.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { SourceOfFundsSettlementReadService } from "../source-of-funds/source-of-funds-settlement-read.service.js";
import type { ISourceOfFundsRepository } from "../source-of-funds/source-of-funds.types.js";
import type { SourceOfFundsStatus } from "../source-of-funds/source-of-funds.types.js";

function majorToPence(major: string): number {
  const n = Number.parseFloat(major.trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function buyerLabelFrom(name: string | null, email: string | null): string | null {
  const n = name?.trim();
  if (n) return n;
  const e = email?.trim();
  if (e) return e;
  return null;
}

function staffLabelFrom(name: string | null, email: string | null): string | null {
  return buyerLabelFrom(name, email);
}

export interface IAdminSourceOfFundsQueryService {
  listEnriched(
    status: SourceOfFundsStatus,
    limit: number,
    offset: number,
  ): Promise<{ rows: AdminSourceOfFundsListRowDto[]; total: number }>;
  getDetail(caseId: string): Promise<AdminSourceOfFundsDetailDto | null>;
  listForUser(userId: string, limit?: number): Promise<AdminSourceOfFundsListRowDto[]>;
}

export class AdminSourceOfFundsQueryService implements IAdminSourceOfFundsQueryService {
  constructor(
    private readonly caseRepo: ISourceOfFundsRepository,
    private readonly docRepo: ISourceOfFundsDocumentRepository,
    private readonly reviewRepo: ISourceOfFundsDocumentReviewRepository,
    private readonly adminUserReader: IAdminUserReader,
    private readonly settlementRead: SourceOfFundsSettlementReadService,
    private readonly mediaUrlResolver: MediaUrlResolver,
  ) {}

  async listEnriched(
    status: SourceOfFundsStatus,
    limit: number,
    offset: number,
  ): Promise<{ rows: AdminSourceOfFundsListRowDto[]; total: number }> {
    const [cases, total] = await Promise.all([
      this.caseRepo.listByStatus(status, limit, offset),
      this.caseRepo.countByStatus(status),
    ]);

    if (cases.length === 0) {
      return { rows: [], total };
    }

    const userIds = [...new Set(cases.map((c) => c.userId))];
    const [buyers, summaries, pendingCounts] = await Promise.all([
      this.loadBuyers(userIds),
      this.settlementRead.summarizeForBuyersBatch(userIds),
      this.caseRepo.countPendingByUserIds(userIds),
    ]);

    const rows: AdminSourceOfFundsListRowDto[] = cases.map((c) => {
      const buyer = buyers.get(c.userId);
      const summary = summaries.get(c.userId);
      return {
        ...c,
        buyerEmail: buyer?.email ?? null,
        buyerName: buyer?.name ?? null,
        buyerLabel: buyerLabelFrom(buyer?.name ?? null, buyer?.email ?? null) ?? "Unknown buyer",
        settlementSummary: summary?.settlementSummary ?? null,
        settlementItemCount: summary?.settlementItemCount ?? 0,
        pendingCasesForBuyer: pendingCounts.get(c.userId) ?? 0,
      };
    });

    return { rows, total };
  }

  async getDetail(caseId: string): Promise<AdminSourceOfFundsDetailDto | null> {
    const caseRecord = await this.caseRepo.findById(caseId);
    if (!caseRecord) return null;

    const userId = caseRecord.userId;
    const reviews = await this.reviewRepo.listForCase(caseId);
    const staffIds = [
      caseRecord.triagedByUserId,
      caseRecord.reviewedByUserId,
      ...reviews.map((r) => r.reviewedByUserId),
    ].filter((id): id is string => typeof id === "string" && id.length > 0);

    const [buyers, staff, settlementItems, currentActiveExposurePence, blockedPayments, docs] =
      await Promise.all([
        this.loadBuyers([userId]),
        this.loadBuyers(staffIds),
        this.settlementRead.listSettlementItemsForBuyer(userId),
        this.settlementRead.sumActivePaymentExposurePence(userId),
        this.settlementRead.listBlockedPaymentsForBuyer(userId),
        this.docRepo.listActiveForCase(caseId),
      ]);

    const buyer = buyers.get(userId);
    const evidenceKeys = caseRecord.evidence ?? [];
    const evidenceDownloads = await this.resolveEvidenceDownloads(evidenceKeys);
    const submittedDocuments = this.resolveSubmittedDocuments(docs, reviews, staff);

    const triagedBy =
      caseRecord.triagedByUserId != null
        ? {
            id: caseRecord.triagedByUserId,
            label:
              staffLabelFrom(
                staff.get(caseRecord.triagedByUserId)?.name ?? null,
                staff.get(caseRecord.triagedByUserId)?.email ?? null,
              ) ?? caseRecord.triagedByUserId,
          }
        : null;

    const reviewedBy =
      caseRecord.reviewedByUserId != null
        ? {
            id: caseRecord.reviewedByUserId,
            label:
              staffLabelFrom(
                staff.get(caseRecord.reviewedByUserId)?.name ?? null,
                staff.get(caseRecord.reviewedByUserId)?.email ?? null,
              ) ?? caseRecord.reviewedByUserId,
          }
        : null;

    return {
      case: caseRecord,
      buyer: {
        id: userId,
        email: buyer?.email ?? null,
        name: buyer?.name ?? null,
        label: buyerLabelFrom(buyer?.name ?? null, buyer?.email ?? null) ?? "Unknown buyer",
      },
      triagedBy,
      reviewedBy,
      exposureAtOpenPence: majorToPence(caseRecord.exposureAmount),
      currentActiveExposurePence,
      settlementItems,
      blockedPayments: blockedPayments.map((p) => ({
        ...p,
        manualReviewReason: "source_of_funds_required" as const,
      })),
      evidenceDownloads,
      documentRequest: {
        requestedAt: caseRecord.documentsRequestedAt?.toISOString() ?? null,
        requestedByUserId: caseRecord.documentsRequestedByUserId,
        note: caseRecord.documentRequestNote,
        requestedDocumentTypes: caseRecord.requestedDocumentTypes ?? [],
        submittedAt: caseRecord.documentsSubmittedAt?.toISOString() ?? null,
      },
      submittedDocuments,
    };
  }

  async listForUser(userId: string, limit = 20): Promise<AdminSourceOfFundsListRowDto[]> {
    const cases = await this.caseRepo.listForUser(userId, limit);
    if (cases.length === 0) return [];

    const [buyers, summaries, pendingCounts] = await Promise.all([
      this.loadBuyers([userId]),
      this.settlementRead.summarizeForBuyersBatch([userId]),
      this.caseRepo.countPendingByUserIds([userId]),
    ]);

    const buyer = buyers.get(userId);
    const summary = summaries.get(userId);
    return cases.map((c) => ({
      ...c,
      buyerEmail: buyer?.email ?? null,
      buyerName: buyer?.name ?? null,
      buyerLabel: buyerLabelFrom(buyer?.name ?? null, buyer?.email ?? null) ?? "Unknown buyer",
      settlementSummary: summary?.settlementSummary ?? null,
      settlementItemCount: summary?.settlementItemCount ?? 0,
      pendingCasesForBuyer: pendingCounts.get(userId) ?? 0,
    }));
  }

  private resolveSubmittedDocuments(
    docs: Awaited<ReturnType<ISourceOfFundsDocumentRepository["listActiveForCase"]>>,
    reviews: Awaited<ReturnType<ISourceOfFundsDocumentReviewRepository["listForCase"]>>,
    staff: Map<string, { email: string | null; name: string | null }>,
  ): AdminSourceOfFundsDetailDto["submittedDocuments"] {
    const reviewByDoc = new Map(reviews.map((r) => [r.documentId, r]));
    return docs.map((doc) => {
      const review = reviewByDoc.get(doc.id);
      const reviewer = review ? staff.get(review.reviewedByUserId) : undefined;
      return {
        id: doc.id,
        requestedType: doc.requestedType,
        label: doc.label,
        fileName: doc.fileName ?? null,
        reviewStatus: doc.reviewStatus,
        uploadedAt: doc.uploadedAt.toISOString(),
        uploadedByUserId: doc.uploadedByUserId,
        downloadUrl: null,
        staffReview: review
          ? {
              checks: review.checks,
              note: review.note,
              reviewedAt: review.reviewedAt.toISOString(),
              reviewedBy: {
                id: review.reviewedByUserId,
                label:
                  staffLabelFrom(reviewer?.name ?? null, reviewer?.email ?? null) ??
                  review.reviewedByUserId,
              },
            }
          : null,
      };
    });
  }

  private async loadBuyers(
    userIds: readonly string[],
  ): Promise<Map<string, { email: string | null; name: string | null }>> {
    const out = new Map<string, { email: string | null; name: string | null }>();
    if (userIds.length === 0) return out;

    const rows = await this.adminUserReader.getByIds([...new Set(userIds)]);
    for (const row of rows) {
      out.set(row.id, { email: row.email ?? null, name: row.name ?? null });
    }
    return out;
  }

  private async resolveEvidenceDownloads(
    keys: readonly string[],
  ): Promise<AdminSourceOfFundsDetailDto["evidenceDownloads"]> {
    if (keys.length === 0) return [];

    const uniqueKeys = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
    const resolved = await this.mediaUrlResolver.resolveManyUnique(uniqueKeys);

    return uniqueKeys.map((key) => {
      const fileName = key.split("/").pop() ?? key;
      const url = resolved.get(key);
      if (!url || url === key) {
        return { key, fileName, downloadUrl: null, error: "download_unavailable" };
      }
      return { key, fileName, downloadUrl: url };
    });
  }
}
