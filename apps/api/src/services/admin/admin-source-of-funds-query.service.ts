import type { Database } from "@auction/db";
import { sourceOfFunds, user } from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  AdminSourceOfFundsDetailDto,
  AdminSourceOfFundsListRowDto,
} from "../../admin/admin-route-dtos.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import { SourceOfFundsSettlementReadService } from "../source-of-funds/source-of-funds-settlement-read.service.js";
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
}

export class AdminSourceOfFundsQueryService implements IAdminSourceOfFundsQueryService {
  private readonly settlementRead: SourceOfFundsSettlementReadService;

  constructor(
    private readonly caseRepo: ISourceOfFundsRepository,
    private readonly db: Database,
    private readonly mediaUrlResolver: MediaUrlResolver,
  ) {
    this.settlementRead = new SourceOfFundsSettlementReadService(db);
  }

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
      this.countPendingCasesByUser(userIds),
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
    const staffIds = [caseRecord.triagedByUserId, caseRecord.reviewedByUserId].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );

    const [buyers, staff, settlementItems, currentActiveExposurePence, blockedPayments] =
      await Promise.all([
        this.loadBuyers([userId]),
        this.loadBuyers(staffIds),
        this.settlementRead.listSettlementItemsForBuyer(userId),
        this.settlementRead.sumActivePaymentExposurePence(userId),
        this.settlementRead.listBlockedPaymentsForBuyer(userId),
      ]);

    const buyer = buyers.get(userId);
    const evidenceKeys = caseRecord.evidence ?? [];
    const evidenceDownloads = await this.resolveEvidenceDownloads(evidenceKeys);

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
    };
  }

  private async loadBuyers(
    userIds: readonly string[],
  ): Promise<Map<string, { email: string | null; name: string | null }>> {
    const out = new Map<string, { email: string | null; name: string | null }>();
    if (userIds.length === 0) return out;

    const rows = await this.db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(inArray(user.id, [...new Set(userIds)]));

    for (const row of rows) {
      out.set(row.id, { email: row.email ?? null, name: row.name ?? null });
    }
    return out;
  }

  private async countPendingCasesByUser(userIds: readonly string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (userIds.length === 0) return out;

    const rows = await this.db
      .select({
        userId: sourceOfFunds.userId,
        n: sql<number>`count(*)::int`,
      })
      .from(sourceOfFunds)
      .where(
        and(
          inArray(sourceOfFunds.userId, [...new Set(userIds)]),
          eq(sourceOfFunds.status, "pending"),
        ),
      )
      .groupBy(sourceOfFunds.userId);

    for (const row of rows) {
      out.set(row.userId, row.n);
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
